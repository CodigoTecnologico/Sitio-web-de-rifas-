const pool = require('../utils/db');

exports.getAll = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM rifas ORDER BY date ASC');
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
  try {
    const { name, description, price, total_boletos, image_url, badge, date } = req.body;
    
    const result = await pool.query(
      `INSERT INTO rifas (name, description, price, total_boletos, image_url, badge, date) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [name, description, price, total_boletos, image_url, badge, date]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error al crear rifa:', err);
    res.status(500).json({ error: 'Error al crear rifa' });
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