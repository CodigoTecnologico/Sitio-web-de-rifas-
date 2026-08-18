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

    // Generar boletos con el precio
    for (let i = 1; i <= total_boletos; i++) {
      await client.query(
        `INSERT INTO boletos (rifa_id, number, status, price)
         VALUES ($1, $2, 'disponible', $3)`,
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
  try {
    const { id } = req.params;
    const { name, description, price, total_boletos, image_url, badge, date } = req.body;

    await pool.query(
      `UPDATE rifas SET name=$1, description=$2, price=$3, total_boletos=$4,
       image_url=$5, badge=$6, date=$7 WHERE id=$8`,
      [name, description, price, total_boletos, image_url, badge, date, id]
    );

    // Actualizar el precio de los boletos asociados
    await pool.query('UPDATE boletos SET price = $1 WHERE rifa_id = $2', [price, id]);

    res.json({ message: 'Rifa actualizada correctamente' });
  } catch (err) {
    console.error('Error al actualizar rifa:', err);
    res.status(500).json({ error: 'Error al actualizar rifa' });
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