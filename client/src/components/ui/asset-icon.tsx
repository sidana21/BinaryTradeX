interface AssetIconProps {
  assetId: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function AssetIcon({ assetId, size = 'md', className = '' }: AssetIconProps) {
  const sizes = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-10 h-10',
  };

  const sizeClass = sizes[size];

  // Extract base pair (remove _OTC suffix)
  const basePair = assetId.replace('_OTC', '');

  // Asset icon mapping with colors and gradients
  const getAssetStyle = (asset: string) => {
    const styles: Record<string, { gradient: string; icon: string; text?: string }> = {
      // Forex Pairs
      'EURUSD': { gradient: 'from-blue-500 to-yellow-500', icon: '€/$', text: 'EUR/USD' },
      'GBPUSD': { gradient: 'from-blue-600 to-green-600', icon: '£/$', text: 'GBP/USD' },
      'USDJPY': { gradient: 'from-green-500 to-red-500', icon: '$/¥', text: 'USD/JPY' },
      'AUDUSD': { gradient: 'from-blue-400 to-yellow-400', icon: 'A$', text: 'AUD/USD' },
      'USDCAD': { gradient: 'from-green-500 to-red-400', icon: '$/C$', text: 'USD/CAD' },
      'NZDUSD': { gradient: 'from-blue-500 to-black', icon: 'NZ$', text: 'NZD/USD' },
      'USDCHF': { gradient: 'from-green-500 to-red-600', icon: '$/₣', text: 'USD/CHF' },
      'EURGBP': { gradient: 'from-blue-500 to-blue-700', icon: '€/£', text: 'EUR/GBP' },
      'EURJPY': { gradient: 'from-blue-500 to-red-500', icon: '€/¥', text: 'EUR/JPY' },
      'GBPJPY': { gradient: 'from-blue-600 to-red-500', icon: '£/¥', text: 'GBP/JPY' },
      'AUDJPY': { gradient: 'from-blue-400 to-red-500', icon: 'A$/¥', text: 'AUD/JPY' },
      'AUDCAD': { gradient: 'from-blue-400 to-red-400', icon: 'A$/C$', text: 'AUD/CAD' },
      'EURAUD': { gradient: 'from-blue-500 to-yellow-400', icon: '€/A$', text: 'EUR/AUD' },
      'EURCAD': { gradient: 'from-blue-500 to-red-400', icon: '€/C$', text: 'EUR/CAD' },
      'EURCHF': { gradient: 'from-blue-500 to-red-600', icon: '€/₣', text: 'EUR/CHF' },
      'GBPAUD': { gradient: 'from-blue-600 to-yellow-400', icon: '£/A$', text: 'GBP/AUD' },
      'GBPCAD': { gradient: 'from-blue-600 to-red-400', icon: '£/C$', text: 'GBP/CAD' },
      'NZDJPY': { gradient: 'from-blue-500 to-red-500', icon: 'NZ$/¥', text: 'NZD/JPY' },
      'CADJPY': { gradient: 'from-red-400 to-red-500', icon: 'C$/¥', text: 'CAD/JPY' },
      'CHFJPY': { gradient: 'from-red-600 to-red-500', icon: '₣/¥', text: 'CHF/JPY' },
      
      // Cryptocurrencies
      'BTCUSD': { gradient: 'from-orange-500 to-yellow-500', icon: '₿', text: 'Bitcoin' },
      'ETHUSD': { gradient: 'from-purple-500 to-blue-500', icon: 'Ξ', text: 'Ethereum' },
      'LTCUSD': { gradient: 'from-gray-400 to-gray-600', icon: 'Ł', text: 'Litecoin' },
      'XRPUSD': { gradient: 'from-blue-400 to-blue-600', icon: 'XRP', text: 'Ripple' },
      'BNBUSD': { gradient: 'from-yellow-500 to-yellow-600', icon: 'BNB', text: 'Binance' },
      'ADAUSD': { gradient: 'from-blue-500 to-blue-700', icon: 'ADA', text: 'Cardano' },
      
      // Commodities
      'GOLD': { gradient: 'from-yellow-400 to-yellow-600', icon: '🏅', text: 'Gold' },
      'SILVER': { gradient: 'from-gray-300 to-gray-500', icon: '⚪', text: 'Silver' },
      'OIL': { gradient: 'from-black to-gray-800', icon: '🛢️', text: 'Oil' },
      'COPPER': { gradient: 'from-orange-600 to-orange-800', icon: '🔶', text: 'Copper' },
      'NATURALGAS': { gradient: 'from-blue-400 to-blue-600', icon: '🔥', text: 'Natural Gas' },
      
      // Indices
      'SPX': { gradient: 'from-blue-600 to-red-600', icon: 'S&P', text: 'S&P 500' },
      'NDX': { gradient: 'from-blue-500 to-purple-600', icon: 'NDQ', text: 'Nasdaq' },
      'DJI': { gradient: 'from-blue-700 to-blue-900', icon: 'DOW', text: 'Dow Jones' },
      'DAX': { gradient: 'from-black to-red-600', icon: 'DAX', text: 'DAX' },
      'FTSE': { gradient: 'from-blue-600 to-red-500', icon: 'FTSE', text: 'FTSE 100' },
      'CAC40': { gradient: 'from-blue-500 to-red-500', icon: 'CAC', text: 'CAC 40' },
      'NIKKEI': { gradient: 'from-red-600 to-white', icon: 'NKY', text: 'Nikkei' },
    };

    return styles[asset] || { gradient: 'from-gray-500 to-gray-700', icon: asset.substring(0, 3), text: asset };
  };

  const assetStyle = getAssetStyle(basePair);

  return (
    <div 
      className={`${sizeClass} rounded-lg bg-gradient-to-br ${assetStyle.gradient} flex items-center justify-center shadow-md ${className}`}
      title={assetStyle.text}
    >
      <span className="text-white font-bold text-xs">
        {assetStyle.icon}
      </span>
    </div>
  );
}
