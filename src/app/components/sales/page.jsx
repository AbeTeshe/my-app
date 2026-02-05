"use client"
import { useEffect, useState } from "react";

const Sales = () => {
    const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch("/api/transactions")
      .then(res => res.json())
      .then(data => {
        setTransactions(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

    if (loading) return <p>Loading...</p>;
  return (
    <div>
      <h1>Transactions</h1>

      <table border="1">
        <thead>
          <tr>
            <th>FS No</th>
            <th>Date</th>
            <th>Item</th>
            <th>Qty</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map(t => (
            <tr key={t.id}>
              <td>{t.fsNo}</td>
              <td>{new Date(t.date).toLocaleDateString()}</td>
              <td>{t.item}</td>
              <td>{t.qty}</td>
              <td>{t.lineTotal}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default Sales
