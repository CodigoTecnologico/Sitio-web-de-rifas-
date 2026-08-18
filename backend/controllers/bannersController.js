const pool = require('../utils/db');

exports.getAll = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM banners ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error al obtener banners:', err);
    res.status(500).json({ error: 'Error al obtener banners' });
  }
};

exports.create = async (req, res) => {
  try {
    const { title, image_url, link, active } = req.body;
    const result = await pool.query(
      'INSERT INTO banners (title, image_url, link, active) VALUES ($1, $2, $3, $4) RETURNING *',
      [title, image_url, link, active]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error al crear banner:', err);
    res.status(500).json({ error: 'Error al crear banner' });
  }
};

exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, image_url, link, active } = req.body;
    await pool.query(
      'UPDATE banners SET title=$1, image_url=$2, link=$3, active=$4 WHERE id=$5',
      [title, image_url, link, active, id]
    );
    res.json({ message: 'Banner actualizado correctamente' });
  } catch (err) {
    console.error('Error al actualizar banner:', err);
    res.status(500).json({ error: 'Error al actualizar banner' });
  }
};

exports.delete = async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM banners WHERE id = $1', [id]);
    res.json({ message: 'Banner eliminado correctamente' });
  } catch (err) {
    console.error('Error al eliminar banner:', err);
    res.status(500).json({ error: 'Error al eliminar banner' });
  }
};