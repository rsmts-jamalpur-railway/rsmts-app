import { useEffect, useState } from 'react';
import { database } from '../database';

export interface AssetFormConfig {
  wagonTypes: string[];
  locoTypes: string[];
  craneTypes: string[];
  actions: string[];
  repairCategories: string[];
  categoryDestinations: {
    [key: string]: string[];
  };
}

const defaultConfig: AssetFormConfig = {
  wagonTypes: ['BOXNHL'],
  locoTypes: ['WAG-9'],
  craneTypes: ['140T Crane'],
  actions: ['POH'],
  repairCategories: ['Light', 'Medium', 'Heavy'],
  categoryDestinations: {
    WAGON: ['WRS-1', 'WRS-2', 'WRS-3', 'WRS-4', 'WRS-5'],
    LOCO: ['DPS', 'Electric Shed'],
    CRANE: ['Crane Shop', 'Trial Yard'],
    TOWER_CAR: ['Crane Shop', 'Tower Car Line']
  }
};

export const useAssetConfig = () => {
  const [config, setConfig] = useState<AssetFormConfig>(defaultConfig);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const settingsCollection = database.collections.get('settings');
        const configRecord = await settingsCollection.query().fetch();
        const assetFormSetting = configRecord.find((r: any) => r.key === 'ASSET_FORM_CONFIG');
        if (assetFormSetting) {
          setConfig(JSON.parse((assetFormSetting as any).value));
        }
      } catch (err) {
        console.warn('Failed to fetch ASSET_FORM_CONFIG from WatermelonDB', err);
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, []);

  const getShopsForCategory = (category: string | undefined): string[] => {
    if (!category) return config.categoryDestinations['WAGON'] || [];
    return config.categoryDestinations[category] || config.categoryDestinations['WAGON'] || [];
  };

  return { config, getShopsForCategory, loading };
};
