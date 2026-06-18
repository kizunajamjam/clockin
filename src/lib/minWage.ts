// 最低賃金（2024年10月改定値）
// 出典: 厚生労働省 https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/koyou_roudou/roudoukijun/minimumichiran/
// 次回改定時に更新が必要

export const MIN_WAGES: Record<string, number> = {
  北海道: 1010,
  青森: 953,
  岩手: 952,
  宮城: 973,
  秋田: 951,
  山形: 955,
  福島: 955,
  茨城: 1005,
  栃木: 1004,
  群馬: 985,
  埼玉: 1078,
  千葉: 1076,
  東京: 1163,
  神奈川: 1162,
  新潟: 985,
  富山: 998,
  石川: 984,
  福井: 984,
  山梨: 988,
  長野: 998,
  岐阜: 1001,
  静岡: 1034,
  愛知: 1077,
  三重: 1023,
  滋賀: 1017,
  京都: 1058,
  大阪: 1114,
  兵庫: 1052,
  奈良: 986,
  和歌山: 980,
  鳥取: 957,
  島根: 962,
  岡山: 982,
  広島: 1020,
  山口: 979,
  徳島: 980,
  香川: 970,
  愛媛: 956,
  高知: 952,
  福岡: 992,
  佐賀: 956,
  長崎: 953,
  熊本: 952,
  大分: 954,
  宮崎: 952,
  鹿児島: 953,
  沖縄: 952,
}

export function getMinWage(prefecture: string): number | null {
  return MIN_WAGES[prefecture] ?? null
}

export const PREFECTURES = Object.keys(MIN_WAGES)
