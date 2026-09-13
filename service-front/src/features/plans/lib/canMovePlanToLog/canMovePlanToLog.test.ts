import { canMovePlanToLog } from './canMovePlanToLog';

const TODAY = '2026-07-01';

describe('canMovePlanToLog', () => {
    it('過去日の予定は移動できる（true）', () => {
        expect(canMovePlanToLog('2026-06-30', TODAY)).toBe(true);
        expect(canMovePlanToLog('2026-01-01', TODAY)).toBe(true);
    });

    it('当日の予定は移動できる（true）', () => {
        expect(canMovePlanToLog('2026-07-01', TODAY)).toBe(true);
    });

    it('未来日の予定は移動できない（false）', () => {
        expect(canMovePlanToLog('2026-07-02', TODAY)).toBe(false);
        expect(canMovePlanToLog('2026-12-31', TODAY)).toBe(false);
    });
});
