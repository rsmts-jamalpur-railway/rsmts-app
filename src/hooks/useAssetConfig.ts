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
  wagonTypes: ['BOXNHL', 'BCNHL', 'BVZI', 'BTPN', 'BOBRN', 'BOXN', 'BRNA'],
  locoTypes: ['WAP7', 'WAG9', 'WAP5', 'WDG4', 'WDM3A'],
  craneTypes: ['140T_CRANE', '175T_CRANE', '140T_COWANS'],
  actions: ['POH', 'ROH', 'NPOH', 'SPECIAL_REPAIR'],
  repairCategories: ['POH', 'ROH', 'NPOH', 'SPECIAL_REPAIR'],
  categoryDestinations: {
    WAGON: ['WRS-1', 'WRS-2', 'WRS-3', 'WRS-4', 'WRS-5'],
    LOCO: ['DPS'],
    CRANE: ['CRANE', 'Trial Yard'],
    TOWER_CAR: ['CRANE', 'Tower Car Line'],
  },
};

export const useAssetConfig = () => {
  const [config, setConfig] = useState<AssetFormConfig>(defaultConfig);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        if ((database.collections as any).has?.('settings')) {
          const settingsCollection = database.collections.get('settings');
          const configRecord = await settingsCollection.query().fetch();
          const assetFormSetting = configRecord.find((r: any) => r.key === 'ASSET_FORM_CONFIG');
          if (assetFormSetting) {
            setConfig(JSON.parse((assetFormSetting as any).value));
          }
        }
      } catch (err) {
        // Fall back gracefully to defaultConfig
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
