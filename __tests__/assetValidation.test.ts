import {
  calculateIndianRailwaysCheckDigit,
  decodeWagonNumber,
  validateAssetNumber,
  detectAssetCategory,
} from '../src/utils/assetValidation';

describe('Indian Railways Asset Validation Engine', () => {
  describe('Modulo-10 Check Digit Algorithm', () => {
    it('calculates correct check digit for 2102184512 -> 8', () => {
      const cd = calculateIndianRailwaysCheckDigit('2102184512');
      expect(cd).toBe(8);
    });

    it('throws error if input is not 10 digits', () => {
      expect(() => calculateIndianRailwaysCheckDigit('12345')).toThrow();
    });
  });

  describe('Wagon Validation & Decoding', () => {
    it('validates a correct 11-digit wagon number', () => {
      const result = validateAssetNumber('21021845128', 'WAGON');
      expect(result.isValid).toBe(true);
      expect(result.breakdown).toBeDefined();
      expect(result.breakdown?.typeName).toContain('BOXNHL');
      expect(result.breakdown?.railwayName).toContain('Eastern Railway');
    });

    it('rejects an 11-digit wagon with invalid check digit and offers autoFix', () => {
      const result = validateAssetNumber('21021845121', 'WAGON');
      expect(result.isValid).toBe(false);
      expect(result.autoFix).toBe('21021845128');
    });

    it('offers autoFix when 10 digits are entered', () => {
      const result = validateAssetNumber('2102184512', 'WAGON');
      expect(result.isValid).toBe(false);
      expect(result.autoFix).toBe('21021845128');
    });

    it('rejects non-numeric wagon numbers', () => {
      const result = validateAssetNumber('2102184512A', 'WAGON');
      expect(result.isValid).toBe(false);
    });
  });

  describe('Locomotive Road Number Validation', () => {
    it('accepts valid 5-digit road numbers', () => {
      const result = validateAssetNumber('30215', 'LOCO');
      expect(result.isValid).toBe(true);
    });

    it('rejects numbers not matching 5 digits', () => {
      const result = validateAssetNumber('3021', 'LOCO');
      expect(result.isValid).toBe(false);
    });
  });

  describe('Crane Number Validation', () => {
    it('accepts valid 6-digit crane road numbers', () => {
      const result = validateAssetNumber('140012', 'CRANE');
      expect(result.isValid).toBe(true);
    });

    it('rejects crane numbers starting with 0', () => {
      const result = validateAssetNumber('014012', 'CRANE');
      expect(result.isValid).toBe(false);
      expect(result.message).toContain('cannot begin with 0');
    });
  });

  describe('Category Auto-Detection', () => {
    it('detects 11 digits as WAGON', () => {
      expect(detectAssetCategory('21021845128')).toBe('WAGON');
    });

    it('detects 5 digits as LOCO', () => {
      expect(detectAssetCategory('30215')).toBe('LOCO');
    });

    it('detects 140xxx as CRANE', () => {
      expect(detectAssetCategory('140012')).toBe('CRANE');
    });

    it('detects DETC / DHTC as TOWER_CAR', () => {
      expect(detectAssetCategory('8W_DETC')).toBe('TOWER_CAR');
    });
  });
});
