import { useState } from "react";
import OtcChart from "@/components/chart/otc-chart";

export default function OtcMarketPage() {
  const [pair, setPair] = useState("EURUSD");

  return (
    <div className="p-4 bg-gray-900 min-h-screen text-white">
      <h1 className="text-2xl mb-4" data-testid="text-page-title">OTC Fake Market</h1>

      <select
        value={pair}
        onChange={(e) => setPair(e.target.value)}
        className="p-2 rounded bg-gray-800 border border-gray-600 mb-4"
        data-testid="select-currency-pair"
      >
        <option value="EURUSD">EUR/USD OTC</option>
        <option value="USDJPY">USD/JPY OTC</option>
        <option value="GBPUSD">GBP/USD OTC</option>
      </select>

      <OtcChart pair={pair} />
    </div>
  );
}
