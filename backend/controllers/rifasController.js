const pool = require('../utils/db');

exports.getAll = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT r.*, 
             COALESCE(b.available_count, 0) AS available_boletos
      FROM rifas r
      LEFT JOIN (
        SELECT rifa_id, COUNT(*) AS available_count
        FROM boletos
        WHERE status = 'disponible'
        GROUP BY rifa_id
      ) b ON r.id = b.rifa_id
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
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Rifa no encontrada' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error al obtener rifa:', err);
    res.status(500).json({ error: 'Error al obtener rifa' });
  }
};

exports.create = async (req, res) => {
  const client = await pool.connect();
  try {
    const { name, description, price, total_boletos, image_url, badge, date } = req.body;

    if (!name || !price || !total_boletos || !date) {
      return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }

    await client.query('BEGIN');

    const rifaResult = await client.query(
      `INSERT INTO rifas (name, description, price, total_boletos, image_url, badge, date)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, name, description, price, total_boletos, image_url, badge, date`,
      [name, description, price, total_boletos, image_url, badge, date]
    );

    const rifaId = rifaResult.rows[0].id;

    // Generar boletos con el precio y evitar duplicados
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
    const { name, description, price, total_boletos, image_url, badge, date } = req.body;

    await client.query('BEGIN');

    // 1. Actualizar datos de la rifa
    await client.query(
      `UPDATE rifas SET name=$1, description=$2, price=$3, total_boletos=$4,
       image_url=$5, badge=$6, date=$7 WHERE id=$8`,
      [name, description, price, total_boletos, image_url, badge, date, id]
    );

    // 2. Actualizar precio de los boletos existentes
    await client.query('UPDATE boletos SET price = $1 WHERE rifa_id = $2', [price, id]);

    // 3. Obtener el total actual de boletos para esta rifa
    const currentBoletos = await client.query(
      'SELECT COUNT(*) AS count FROM boletos WHERE rifa_id = $1',
      [id]
    );
    const currentCount = parseInt(currentBoletos.rows[0].count);

    // 4. Si hay que eliminar boletos (reducir total)
    if (currentCount > total_boletos) {
      // Eliminar solo los que están disponibles y tienen número > total_boletos
      await client.query(
        'DELETE FROM boletos WHERE rifa_id = $1 AND number > $2 AND status = $3',
        [id, total_boletos, 'disponible']
      );

      // Comprobar cuántos quedaron después de eliminar
      const afterDelete = await client.query(
        'SELECT COUNT(*) AS count FROM boletos WHERE rifa_id = $1',
        [id]
      );
      const remaining = parseInt(afterDelete.rows[0].count);

      if (remaining > total_boletos) {
        // Hay boletos vendidos o reservados con número mayor al total, no se pueden eliminar
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: `No se puede reducir a ${total_boletos} boletos porque hay boletos vendidos o reservados con números mayores.`
        });
      }
    }

    // 5. Si hay que agregar boletos (aumentar total)
    if (currentCount < total_boletos) {
      // Obtener los números existentes
      const existingNumbers = new Set(
        (await client.query('SELECT number FROM boletos WHERE rifa_id = $1', [id]))
          .rows.map(r => r.number)
      );

      // Insertar los que falten
      for (let i = 1; i <= total_boletos; i++) {
        if (!existingNumbers.has(i)) {
          await client.query(
            `INSERT INTO boletos (rifa_id, number, status, price)
             VALUES ($1, $2, 'disponible', $3)`,
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
    const { id } = req.params;
    await pool.query('DELETE FROM rifas WHERE id = $1', [id]);
    res.json({ message: 'Rifa eliminada correctamente' });
  } catch (err) {
    console.error('Error al eliminar rifa:', err);
    res.status(500).json({ error: 'Error al eliminar rifa' });
  }
};

exports.setGanador = async (req, res) => {
  const { id } = req.params;
  const { numero_ganador } = req.body;

  if (!numero_ganador) {
    return res.status(400).json({ error: 'Número ganador requerido' });
  }

  const client = await pool.connect();
  try {
    // Obtener boletos vendidos/reservados de la rifa
    const boletos = await client.query(
      `SELECT id, number, status FROM boletos 
       WHERE rifa_id = $1 AND status IN ('vendido','reservado')
       ORDER BY number ASC`,
      [id]
    );

    if (boletos.rows.length === 0) {
      return res.status(400).json({ error: 'No hay boletos vendidos para elegir ganador' });
    }

    // Calcular suma de dígitos
    const sumaDigitos = numero_ganador
      .replace(/\D/g, '') // solo números
      .split('')
      .reduce((acc, digit) => acc + parseInt(digit), 0);

    const totalVendidos = boletos.rows.length;
    const indiceGanador = sumaDigitos % totalVendidos;

    const boletoGanador = boletos.rows[indiceGanador];

    // Guardar en la rifa
    await client.query(
      `UPDATE rifas SET numero_ganador = $1, ganador_boleto_id = $2 WHERE id = $3`,
      [numero_ganador, boletoGanador.id, id]
    );

    res.json({
      message: 'Ganador determinado correctamente',
      ganador: {
        boleto: boletoGanador.number,
        comprador: boletoGanador.buyer_name,
        telefono: boletoGanador.phone
      }
    });
  } catch (err) {
    console.error('Error al determinar ganador:', err);
    res.status(500).json({ error: 'Error al determinar ganador' });
  } finally {
    client.release();
  }
};