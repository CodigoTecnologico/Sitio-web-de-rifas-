const pool = require('../utils/db');

exports.getAll = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT r.*, 
             COALESCE(b.available_count, 0) AS available_boletos,
             bg.number AS ganador_numero,
             bg.buyer_name AS ganador_comprador
      FROM rifas r
      LEFT JOIN (
        SELECT rifa_id, COUNT(*) AS available_count
        FROM boletos
        WHERE status = 'disponible'
        GROUP BY rifa_id
      ) b ON r.id = b.rifa_id
      LEFT JOIN boletos bg ON r.ganador_boleto_id = bg.id
      ORDER BY r.date ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Error al obtener rifas:', err);
    res.status(500).json({ error: 'Error al obtener rifas' });
  }
};

exports.getOne = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM rifas WHERE id = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Rifa no encontrada' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error al obtener rifa:', err);
    res.status(500).json({ error: 'Error al obtener rifa' });
  }
};

exports.create = async (req, res) => {
  const client = await pool.connect();
  try {
    const { name, description, price, total_boletos, image_url, badge, date, stream_url, stream_duration } = req.body;
    if (!name || !price || !total_boletos || !date) {
      return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }

    await client.query('BEGIN');

    const rifaResult = await client.query(
      `INSERT INTO rifas (name, description, price, total_boletos, image_url, badge, date, stream_url, stream_duration)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [name, description, price, total_boletos, image_url, badge, date, stream_url, stream_duration || 60]
    );

    const rifaId = rifaResult.rows[0].id;

    for (let i = 1; i <= total_boletos; i++) {
      await client.query(
        `INSERT INTO boletos (rifa_id, number, status, price)
         VALUES ($1, $2, 'disponible', $3)
         ON CONFLICT (rifa_id, number) DO NOTHING`,
        [rifaId, i, price]
      );
    }

    await client.query('COMMIT');
    res.status(201).json(rifaResult.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error al crear rifa:', err);
    res.status(500).json({ error: 'Error al crear rifa' });
  } finally {
    client.release();
  }
};

exports.update = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { name, description, price, total_boletos, image_url, badge, date, stream_url, stream_duration } = req.body;

    await client.query('BEGIN');

    await client.query(
      `UPDATE rifas SET name=$1, description=$2, price=$3, total_boletos=$4,
       image_url=$5, badge=$6, date=$7, stream_url=$8, stream_duration=$9 WHERE id=$10`,
      [name, description, price, total_boletos, image_url, badge, date, stream_url, stream_duration || 60, id]
    );

    await client.query('UPDATE boletos SET price = $1 WHERE rifa_id = $2', [price, id]);

    const currentBoletos = await client.query('SELECT COUNT(*) AS count FROM boletos WHERE rifa_id = $1', [id]);
    const currentCount = parseInt(currentBoletos.rows[0].count);

    if (currentCount > total_boletos) {
      await client.query(
        'DELETE FROM boletos WHERE rifa_id = $1 AND number > $2 AND status = $3',
        [id, total_boletos, 'disponible']
      );
      const afterDelete = await client.query('SELECT COUNT(*) AS count FROM boletos WHERE rifa_id = $1', [id]);
      if (parseInt(afterDelete.rows[0].count) > total_boletos) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'No se puede reducir la cantidad porque hay boletos vendidos/reservados' });
      }
    }

    if (currentCount < total_boletos) {
      const existing = new Set(
        (await client.query('SELECT number FROM boletos WHERE rifa_id = $1', [id])).rows.map(r => r.number)
      );
      for (let i = 1; i <= total_boletos; i++) {
        if (!existing.has(i)) {
          await client.query(
            `INSERT INTO boletos (rifa_id, number, status, price) VALUES ($1, $2, 'disponible', $3)`,
            [id, i, price]
          );
        }
      }
    }

    await client.query('COMMIT');
    res.json({ message: 'Rifa actualizada correctamente' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error al actualizar rifa:', err);
    res.status(500).json({ error: 'Error al actualizar rifa' });
  } finally {
    client.release();
  }
};

exports.delete = async (req, res) => {
  try {
    await pool.query('DELETE FROM rifas WHERE id = $1', [req.params.id]);
    res.json({ message: 'Rifa eliminada correctamente' });
  } catch (err) {
    console.error('Error al eliminar rifa:', err);
    res.status(500).json({ error: 'Error al eliminar rifa' });
  }
};

exports.setGanador = async (req, res) => {
  const { id } = req.params;
  const { numero_ganador } = req.body;
  if (!numero_ganador) return res.status(400).json({ error: 'Número ganador requerido' });

  const client = await pool.connect();
  try {
    const boletos = await client.query(
      `SELECT id, number, status, buyer_name, phone FROM boletos 
       WHERE rifa_id = $1 AND status IN ('vendido','reservado')
       ORDER BY number ASC`,
      [id]
    );
    if (boletos.rows.length === 0) return res.status(400).json({ error: 'No hay boletos vendidos' });

    const sumaDigitos = numero_ganador.replace(/\D/g, '').split('').reduce((acc, d) => acc + parseInt(d), 0);
    const ganador = boletos.rows[sumaDigitos % boletos.rows.length];

    await client.query(
      'UPDATE rifas SET numero_ganador = $1, ganador_boleto_id = $2 WHERE id = $3',
      [numero_ganador, ganador.id, id]
    );

    res.json({ message: 'Ganador determinado', ganador: { boleto: ganador.number, comprador: ganador.buyer_name, telefono: ganador.phone } });
  } catch (err) {
    console.error('Error al determinar ganador:', err);
    res.status(500).json({ error: 'Error al determinar ganador' });
  } finally {
    client.release();
  }
};

// Actualizar ganador manualmente
exports.updateGanadorManual = async (req, res) => {
  const { id } = req.params;
  const { numero_ganador, boleto_ganador, nombre_ganador } = req.body;

  if (!numero_ganador) {
    return res.status(400).json({ error: 'Número ganador requerido' });
  }

  try {
    let ganadorBoletoId = null;
    if (boleto_ganador) {
      const boleto = await pool.query(
        'SELECT id FROM boletos WHERE rifa_id = $1 AND number = $2 LIMIT 1',
        [id, boleto_ganador]
      );
      if (boleto.rows.length > 0) {
        ganadorBoletoId = boleto.rows[0].id;
      }
    }

    await pool.query(
      'UPDATE rifas SET numero_ganador = $1, ganador_boleto_id = $2, ganador_comprador = $3 WHERE id = $4',
      [numero_ganador, ganadorBoletoId, nombre_ganador || null, id]
    );

    res.json({ message: 'Ganador actualizado correctamente' });
  } catch (err) {
    console.error('Error al actualizar ganador manual:', err);
    res.status(500).json({ error: 'Error al actualizar ganador' });
  }
};

// Limpiar ganador
exports.clearGanador = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query(
      'UPDATE rifas SET numero_ganador = NULL, ganador_boleto_id = NULL, ganador_comprador = NULL WHERE id = $1',
      [id]
    );
    res.json({ message: 'Ganador eliminado correctamente' });
  } catch (err) {
    console.error('Error al limpiar ganador:', err);
    res.status(500).json({ error: 'Error al limpiar ganador' });
  }
};