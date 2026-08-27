const pool = require('../utils/db');

exports.getByRifa = async (req, res) => {
  try {
    const { rifaId } = req.params;
    const result = await pool.query(
      'SELECT * FROM boletos WHERE rifa_id = $1 ORDER BY number ASC',
      [rifaId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error al obtener boletos:', err);
    res.status(500).json({ error: 'Error al obtener boletos' });
  }
};

exports.reserve = async (req, res) => {
  const { rifaId, numbers, name, phone } = req.body;
  
  if (!rifaId || !numbers || numbers.length === 0 || !name || !phone) {
    return res.status(400).json({ error: 'Datos incompletos' });
  }

  // Eliminar duplicados en numbers
  const uniqueNumbers = [...new Set(numbers)];
  if (uniqueNumbers.length !== numbers.length) {
    return res.status(400).json({ error: 'Hay números duplicados en la reserva' });
  }
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    for (const number of uniqueNumbers) {
      const result = await client.query(
        'SELECT status FROM boletos WHERE rifa_id = $1 AND number = $2 FOR UPDATE',
        [rifaId, number]
      );
      
      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `El número ${number} no existe` });
      }
      
      if (result.rows[0].status !== 'disponible') {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `El número ${number} ya no está disponible` });
      }
      
      await client.query(
        `UPDATE boletos SET status='reservado', buyer_name=$1, phone=$2, 
         reservation_date=NOW() WHERE rifa_id=$3 AND number=$4`,
        [name, phone, rifaId, number]
      );
    }
    
    await client.query('COMMIT');
    res.json({ message: 'Boletos reservados exitosamente' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error al reservar boletos:', err);
    res.status(500).json({ error: 'Error al reservar boletos' });
  } finally {
    client.release();
  }
};

exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, buyer_name, phone, sale_date, price, contenido } = req.body;

    const safeSaleDate = sale_date && sale_date.trim() !== '' ? sale_date : null;

    await pool.query(
      `UPDATE boletos SET status=$1, buyer_name=$2, phone=$3, sale_date=$4, price=$5, contenido=$6 WHERE id=$7`,
      [status, buyer_name, phone, safeSaleDate, price, contenido, id]
    );

    res.json({ message: 'Boleto actualizado correctamente' });
  } catch (err) {
    console.error('Error al actualizar boleto:', err);
    res.status(500).json({ error: 'Error al actualizar boleto' });
  }
};

exports.generateBoletos = async (req, res) => {
  const { rifaId, total } = req.body;
  
  try {
    const client = await pool.connect();
    await client.query('BEGIN');
    
    for (let i = 1; i <= total; i++) {
      await client.query(
        `INSERT INTO boletos (rifa_id, number) VALUES ($1, $2) 
         ON CONFLICT (rifa_id, number) DO NOTHING`,
        [rifaId, i]
      );
    }
    
    await client.query('COMMIT');
    client.release();
    res.json({ message: `${total} boletos generados` });
  } catch (err) {
    console.error('Error al generar boletos:', err);
    res.status(500).json({ error: 'Error al generar boletos' });
  }
};