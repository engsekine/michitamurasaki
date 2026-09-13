// `sharp` はネイティブ addon（libvips）を require するため、ブラウザ実行
// （storybook / vitest browser mode）ではモジュール評価の時点で失敗する。
// story は Server Action（photoActions → imageProcessing）を実際には実行しないため、
// 評価だけ通る stub に alias する（main.ts の viteFinal。unit テストは実 sharp を使う）。
const sharpStub = (): never => {
    throw new Error('sharp はブラウザ実行では利用できません（server 専用モジュール）');
};

export default sharpStub;
