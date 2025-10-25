import { useState } from 'react';
import type { Asset } from '@shared/schema';
import { AssetIcon } from '@/components/ui/asset-icon';

interface AssetListProps {
  assets: Asset[];
  selectedAsset: Asset | null;
  onAssetSelect: (asset: Asset) => void;
  isLoading: boolean;
}

export function AssetList({ assets, selectedAsset, onAssetSelect, isLoading }: AssetListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const categories = [
    { key: 'all', label: 'الكل' },
    { key: 'forex', label: 'فوركس' },
    { key: 'otc', label: 'OTC' },
    { key: 'crypto', label: 'عملات رقمية' },
    { key: 'commodity', label: 'سلع' },
    { key: 'index', label: 'مؤشرات' },
  ];

  const filteredAssets = assets.filter(asset => {
    const matchesSearch = asset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         asset.symbol.toLowerCase().includes(searchQuery.toLowerCase());
    const isOTC = asset.name.includes('OTC') || asset.id.includes('OTC');
    const assetCategory = isOTC ? 'otc' : asset.category;
    const matchesCategory = selectedCategory === 'all' || 
                           (selectedCategory === 'otc' && isOTC) ||
                           (selectedCategory === 'forex' && asset.category === 'forex' && !isOTC) ||
                           (selectedCategory !== 'otc' && selectedCategory !== 'forex' && asset.category === selectedCategory);
    return matchesSearch && matchesCategory && asset.isActive;
  });

  const getAssetIcon = (category: string) => {
    switch (category) {
      case 'forex':
        return 'fas fa-dollar-sign';
      case 'crypto':
        return 'fab fa-bitcoin';
      case 'commodity':
        return 'fas fa-oil-can';
      case 'index':
        return 'fas fa-chart-line';
      default:
        return 'fas fa-chart-line';
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'forex':
        return 'عملات';
      case 'crypto':
        return 'عملات رقمية';
      case 'commodity':
        return 'سلع';
      case 'index':
        return 'مؤشرات';
      default:
        return category;
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        <div className="animate-pulse">
          <div className="h-10 bg-secondary rounded-lg mb-4"></div>
          <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-8 w-20 bg-secondary rounded-md"></div>
            ))}
          </div>
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-16 bg-secondary rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      {/* Search Assets */}
      <div className="mb-4">
        <div className="relative">
          <i className="fas fa-search absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"></i>
          <input
            type="text"
            placeholder="البحث عن أصل..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-secondary border border-input rounded-lg pr-10 pl-4 py-2 text-sm focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      {/* Asset Categories */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
        {categories.map(category => (
          <button
            key={category.key}
            onClick={() => setSelectedCategory(category.key)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
              selectedCategory === category.key
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-muted-foreground hover:text-foreground'
            }`}
          >
            {category.label}
          </button>
        ))}
      </div>

      {/* Asset List */}
      <div className="space-y-2">
        {filteredAssets.map(asset => {
          const priceChange = parseFloat(asset.priceChange || '0');
          const isPositive = priceChange >= 0;
          
          return (
            <button
              key={asset.id}
              onClick={() => onAssetSelect(asset)}
              data-testid={`asset-${asset.id}`}
              className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer ${
                selectedAsset?.id === asset.id
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:bg-secondary/50'
              }`}
            >
              <div className="flex items-center gap-3">
                <AssetIcon assetId={asset.id} size="md" />
                <div>
                  <div className="font-semibold text-sm">{asset.name}</div>
                  <div className="text-xs text-muted-foreground">{getCategoryLabel(asset.category)}</div>
                </div>
              </div>
              <div className="text-left">
                <div className="font-mono font-semibold text-sm">{asset.currentPrice}</div>
                <div className={`text-xs flex items-center gap-1 ${
                  isPositive ? 'text-success' : 'text-destructive'
                }`}>
                  <i className={`fas fa-arrow-${isPositive ? 'up' : 'down'}`}></i>
                  <span>{isPositive ? '+' : ''}{asset.priceChangePercent}%</span>
                </div>
              </div>
            </button>
          );
        })}
        
        {filteredAssets.length === 0 && (
          <div className="text-center text-muted-foreground text-sm py-8">
            <i className="fas fa-search text-2xl mb-2"></i>
            <p>لم يتم العثور على أصول</p>
          </div>
        )}
      </div>
    </div>
  );
}
