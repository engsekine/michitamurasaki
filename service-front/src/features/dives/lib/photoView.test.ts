import {
    buildPhotoAlt,
    type CoverThumbRef,
    mapDivePhotoRow,
    selectCoverThumbPaths,
    toBrowserSignedUrl,
    toDivePhotoView,
} from './photoView';

const row = (over: Record<string, unknown> = {}) => ({
    id: 'p1',
    dive_id: 'd1',
    user_id: 'u1',
    display_path: 'u1/d1/display/p1.webp',
    thumb_path: 'u1/d1/thumb/p1.webp',
    caption: '',
    sort_order: 0,
    is_cover: true,
    width: 2048,
    height: 1536,
    created_at: '2026-06-16T00:00:00Z',
    updated_at: '2026-06-16T00:00:00Z',
    deleted_at: null,
    ...over,
});

describe('mapDivePhotoRow', () => {
    it('snake_case 行を camelCase に変換する', () => {
        expect(mapDivePhotoRow(row())).toEqual({
            id: 'p1',
            diveId: 'd1',
            displayPath: 'u1/d1/display/p1.webp',
            thumbPath: 'u1/d1/thumb/p1.webp',
            caption: '',
            sortOrder: 0,
            isCover: true,
            width: 2048,
            height: 1536,
        });
    });
});

describe('buildPhotoAlt', () => {
    it('キャプションがあれば優先する', () => {
        expect(buildPhotoAlt('沖縄の珊瑚', '2026-06-16 のダイブ')).toBe('沖縄の珊瑚');
    });
    it('空・空白のみならフォールバック', () => {
        expect(buildPhotoAlt('', '2026-06-16 のダイブ')).toBe('2026-06-16 のダイブ');
        expect(buildPhotoAlt('   ', 'fallback')).toBe('fallback');
    });
});

describe('toBrowserSignedUrl', () => {
    it('内部ホストを公開 URL のホストに差し替える（パス・トークンは保持）', () => {
        const signed =
            'http://host.docker.internal:54321/storage/v1/object/sign/dive-photos/u1/d1/thumb/p1.webp?token=abc.def.ghi';
        const result = toBrowserSignedUrl(signed, 'http://127.0.0.1:54321');
        expect(result).toBe(
            'http://127.0.0.1:54321/storage/v1/object/sign/dive-photos/u1/d1/thumb/p1.webp?token=abc.def.ghi',
        );
    });

    it('https の公開 URL にも対応する', () => {
        const signed = 'http://host.docker.internal:54321/storage/v1/object/sign/x.webp?token=t';
        expect(toBrowserSignedUrl(signed, 'https://proj.supabase.co')).toBe(
            'https://proj.supabase.co/storage/v1/object/sign/x.webp?token=t',
        );
    });

    it('publicBaseUrl 未設定なら元の URL を返す', () => {
        const signed = 'http://host.docker.internal:54321/storage/v1/object/sign/x.webp?token=t';
        expect(toBrowserSignedUrl(signed, undefined)).toBe(signed);
    });

    it('不正な URL は元の値を返す', () => {
        expect(toBrowserSignedUrl('not-a-url', 'http://127.0.0.1:54321')).toBe('not-a-url');
    });
});

describe('toDivePhotoView', () => {
    const photo = mapDivePhotoRow(row({ caption: '海' }));

    it('display/thumb の署名 URL を解決して View を返す', () => {
        const urls = new Map([
            ['u1/d1/display/p1.webp', 'https://signed/display'],
            ['u1/d1/thumb/p1.webp', 'https://signed/thumb'],
        ]);
        expect(toDivePhotoView(photo, urls, 'fb')).toEqual({
            id: 'p1',
            displayUrl: 'https://signed/display',
            thumbUrl: 'https://signed/thumb',
            caption: '海',
            isCover: true,
            width: 2048,
            height: 1536,
            alt: '海',
        });
    });

    it('URL 解決に失敗した写真は null', () => {
        expect(toDivePhotoView(photo, new Map(), 'fb')).toBeNull();
    });
});

describe('selectCoverThumbPaths', () => {
    const ref = (over: Partial<CoverThumbRef> = {}): CoverThumbRef => ({
        diveId: 'd1',
        thumbPath: 't0.webp',
        isCover: false,
        sortOrder: 0,
        ...over,
    });

    it('写真がなければ空マップ', () => {
        expect(selectCoverThumbPaths([]).size).toBe(0);
    });

    it('cover フラグの写真を優先する（sort_order が後でも勝つ）', () => {
        const result = selectCoverThumbPaths([
            ref({ thumbPath: 'a.webp', isCover: false, sortOrder: 0 }),
            ref({ thumbPath: 'cover.webp', isCover: true, sortOrder: 5 }),
        ]);
        expect(result.get('d1')).toBe('cover.webp');
    });

    it('cover がなければ sort_order の小さい写真を選ぶ', () => {
        const result = selectCoverThumbPaths([
            ref({ thumbPath: 'b.webp', sortOrder: 2 }),
            ref({ thumbPath: 'a.webp', sortOrder: 1 }),
        ]);
        expect(result.get('d1')).toBe('a.webp');
    });

    it('ダイブごとに 1 枚ずつ選ぶ', () => {
        const result = selectCoverThumbPaths([
            ref({ diveId: 'd1', thumbPath: 'd1.webp', sortOrder: 0 }),
            ref({ diveId: 'd2', thumbPath: 'd2.webp', sortOrder: 0 }),
        ]);
        expect(result.get('d1')).toBe('d1.webp');
        expect(result.get('d2')).toBe('d2.webp');
    });
});
