"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import React from 'react';

const Analyzer = () => {
  const [items, setItems] = useState([]);

  const parseFile = async (file) => {
    const text = await file.text();
    // Split by "FS No." to isolate each receipt
    const blocks = text.split(/FS No\.\s+/).slice(1);
    const allItems = [];

    const footerKeywords = ["TXBL1", "TAX1", "TOTAL", "CASH", "ITEM#", "CHANGE", "^T^O^T^A^L", "SESSION Z REPORT"];

    blocks.forEach(block => {
      // 1. Metadata Extraction
      const fsNoMatch = block.match(/^(\d+)/);
      if (!fsNoMatch) return;
      const fsNo = fsNoMatch[1];

      const dateMatch = block.match(/(\d{2}\/\d{2}\/\d{4})/);
      const date = dateMatch ? dateMatch[0] : "";

      const tinMatch = block.match(/BUYER'S TIN:\s*(\d+)/i);
      const buyerTIN = tinMatch ? tinMatch[1] : "CASH";

      // 2. State-Based Line Processing
      const lines = block.split("\n").map(l => l.trim()).filter(l => l);
      
      let tempReceiptItems = [];
      let pendingQty = 1;
      let pendingUnitPrice = null;

      for (let line of lines) {
        // Exit early if we hit the footer or a Z-Report section
        if (footerKeywords.some(key => line.toUpperCase().includes(key))) break;
        if (/[–-]{5,}/.test(line)) break;

        // Pattern A: Quantity Line (e.g., "2 x *826.090")
        const qtyMatch = line.match(/^(-?\d+)\s*x\s*\*([\d,.]+)/);
        // Pattern B: Item Line (e.g., "ST.GEORGE *1,652.18")
        const itemMatch = line.match(/^([A-Z\s\.\^0-9\-]+)\s*\*(-?[\d,.]+)/i);

        if (qtyMatch) {
          pendingQty = parseInt(qtyMatch[1]);
          pendingUnitPrice = parseFloat(qtyMatch[2].replace(/,/g, ""));
        } else if (itemMatch) {
          const name = itemMatch[1].replace(/\^/g, "").trim();
          const lineTotal = parseFloat(itemMatch[2].replace(/,/g, ""));
          
          // Skip if the "item name" is just metadata or noise
          if (name === fsNo || name === date || name.includes("TIN") || name.length < 2) continue;

          // If we had a pending unit price from the previous line, use it. 
          // Otherwise, the lineTotal IS the unit price (Qty 1).
          const unitPrice = pendingUnitPrice !== null ? pendingUnitPrice : lineTotal;

          tempReceiptItems.push({
            fsNo,
            date,
            buyerTIN,
            item: name,
            qty: pendingQty,
            unitPrice: Math.abs(unitPrice).toFixed(2),
            lineTotal: lineTotal
          });

          // Reset state for next item
          pendingQty = 1;
          pendingUnitPrice = null;
        }
      }

      // 3. Void Filtering (Pairs positive and negative totals for the same item)
      const survivors = [];
      const usedIndices = new Set();

      for (let i = 0; i < tempReceiptItems.length; i++) {
        if (usedIndices.has(i)) continue;
        const current = tempReceiptItems[i];

        if (current.lineTotal > 0) {
          const voidIdx = tempReceiptItems.findIndex((target, idx) => 
            idx > i && 
            !usedIndices.has(idx) && 
            target.item === current.item && 
            Math.abs(target.lineTotal + current.lineTotal) < 0.01
          );

          if (voidIdx !== -1) {
            usedIndices.add(i);
            usedIndices.add(voidIdx);
          } else {
            current.lineTotal = current.lineTotal.toFixed(2);
            survivors.push(current);
          }
        }
      }
      allItems.push(...survivors);
    });

    setItems(allItems);
  };

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(items), "Consolidated Sales");
    XLSX.writeFile(wb, "Receipt_Data_Export.xlsx");
  };

  return (
    <div className="p-2 max-w-6xl mx-auto font-sans bg-gray-50 min-h-screen">
      <div className="bg-white p-2 rounded-2xl shadow-sm border border-gray-200 mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Ethiopian Receipt Parser</h1>
        <p className="text-gray-500 mt-2">Processes split quantity lines, multi-item receipts, and Buyer TINs.</p>
        
        <div className="mt-6 flex items-center gap-4 bg-blue-50 p-4 rounded-xl border border-blue-100">
          <input 
            type="file" accept=".txt" 
            onChange={(e) => parseFile(e.target.files[0])}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-6 file:rounded-lg file:border-0 file:text-sm file:font-bold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
          />
          {items.length > 0 && (
            <button onClick={exportExcel} className="bg-green-600 text-white px-8 py-2 rounded-lg font-bold hover:bg-green-700 shadow-lg transition-all">
              Download Excel ({items.length} Items)
            </button>
          )}
        </div>
      </div>

      {items.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-100">
              <tr>
                {["FS No", "Date", "Buyer TIN", "Product", "Qty", "Price", "Total"].map(h => (
                  <th key={h} className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {items.map((it, idx) => (
                <tr key={idx} className="hover:bg-blue-50/30">
                  <td className="px-6 py-4 text-sm font-mono text-gray-500">#{it.fsNo}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{it.date}</td>
                  <td className="px-6 py-4 text-sm font-mono text-blue-500 font-bold">{it.buyerTIN}</td>
                  <td className="px-6 py-4 text-sm font-bold text-gray-800">{it.item}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{it.qty}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{it.unitPrice}</td>
                  <td className="px-6 py-4 text-sm font-black text-gray-900">{it.lineTotal}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Analyzer;