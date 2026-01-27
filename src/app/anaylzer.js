"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import React from 'react';

const Analyzer = () => {
  const [items, setItems] = useState([]);

  const parseFile = async (file) => {
    const text = await file.text();
    const blocks = text.split(/FS No\.\s+/).slice(1);
    const allItems = [];

    blocks.forEach(block => {
      // 1. Metadata Extraction
      const fsNoMatch = block.match(/^(\d+)/);
      if (!fsNoMatch) return;
      const fsNo = fsNoMatch[1];

      const dateMatch = block.match(/(\d{2}\/\d{2}\/\d{4})/);
      const date = dateMatch ? dateMatch[0] : "";

      const tinMatch = block.match(/BUYER'S TIN:\s*(\d+)/);
      const buyerTIN = tinMatch ? tinMatch[1] : "";

      // 2. Isolate Item Section
      const separatorIndex = block.indexOf("----------------------------------------");
      const itemSection = separatorIndex !== -1 ? block.substring(0, separatorIndex) : block;
      const lines = itemSection.split("\n").map(l => l.trim()).filter(l => l);

      let tempReceiptItems = [];
      let pendingQty = null;
      let pendingUnitPrice = null;

      // 3. Parse all lines including negative ones
      lines.forEach((line) => {
        // Pattern: Quantity line (e.g., "50 x *1,143.480" or "-50 x ...")
        const qtyMatch = line.match(/^(-?\d+)\s*x\s*\*([\d,.]+)/);
        // Pattern: Item line (e.g., "ST.GEORGE *-57,174.00")
        const itemMatch = line.match(/^([A-Z\s\.\^0-9]+)\s*\*(-?[\d,.]+)/i);

        if (qtyMatch) {
          pendingQty = parseInt(qtyMatch[1]);
          pendingUnitPrice = parseFloat(qtyMatch[2].replace(/,/g, ""));
        } else if (itemMatch) {
          const name = itemMatch[1].replace(/\^/g, "").trim();
          const lineTotal = parseFloat(itemMatch[2].replace(/,/g, ""));
          
          // Skip header/footer noise
          if (name === "FS No" || name.includes("TIN")) return;

          const qty = pendingQty !== null ? pendingQty : 1;
          const unitPrice = pendingUnitPrice !== null ? pendingUnitPrice : lineTotal;

          tempReceiptItems.push({
            fsNo,
            date,
            buyerTIN,
            item: name,
            qty: qty,
            unitPrice: Math.abs(unitPrice).toFixed(2),
            lineTotal: lineTotal // Keep raw total to detect negatives
          });

          // Reset trackers
          pendingQty = null;
          pendingUnitPrice = null;
        }
      });

      // 4. VOID CANCELLATION LOGIC
      // We group items and filter out pairs that cancel each other out
      const finalItemsForThisReceipt = [];
      const processedIndices = new Set();

      for (let i = 0; i < tempReceiptItems.length; i++) {
        if (processedIndices.has(i)) continue;

        const current = tempReceiptItems[i];

        // If this is a positive item, look ahead for its negative "VOID" twin
        if (current.lineTotal > 0) {
          const voidIndex = tempReceiptItems.findIndex((item, idx) => 
            idx > i && 
            !processedIndices.has(idx) &&
            item.item === current.item && 
            item.lineTotal === -current.lineTotal
          );

          if (voidIndex !== -1) {
            // Found a void! Mark both as processed so they aren't added
            processedIndices.add(i);
            processedIndices.add(voidIndex);
          } else {
            // No void found, this is a valid sale
            current.lineTotal = current.lineTotal.toFixed(2);
            finalItemsForThisReceipt.push(current);
          }
        }
      }

      allItems.push(...finalItemsForThisReceipt);
    });

    setItems(allItems);
  };

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(items), "Receipt Items");
    XLSX.writeFile(wb, "Receipt_Data_Cleaned.xlsx");
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Ethiopian Receipt Analyzer (Partial Void Support)</h1>
        {items.length > 0 && (
          <button onClick={exportExcel} className="bg-green-600 text-white px-4 py-2 rounded shadow hover:bg-green-700">
            Export {items.length} Items to Excel
          </button>
        )}
      </div>
      
      <div className="mb-8 bg-blue-50 p-6 rounded-lg border border-blue-200">
        <input 
          type="file" accept=".txt" 
          onChange={(e) => parseFile(e.target.files[0])}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700"
        />
        <p className="text-xs text-blue-600 mt-2">Automatically detects and removes items followed by a VOID correction line.</p>
      </div>

      {items.length > 0 && (
        <div className="border rounded-lg overflow-hidden bg-white shadow-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {["FS No", "Date", "Buyer TIN", "Item Name", "Qty", "Unit Price", "Line Total"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {items.map((it, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-sm text-gray-600">{it.fsNo}</td>
                  <td className="px-4 py-2 text-sm text-gray-600">{it.date}</td>
                  <td className="px-4 py-2 text-sm text-gray-400 font-mono">{it.buyerTIN || "-"}</td>
                  <td className="px-4 py-2 text-sm font-medium text-gray-900">{it.item}</td>
                  <td className="px-4 py-2 text-sm text-gray-600">{it.qty}</td>
                  <td className="px-4 py-2 text-sm text-gray-600">{it.unitPrice}</td>
                  <td className="px-4 py-2 text-sm font-bold text-blue-600">{it.lineTotal}</td>
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