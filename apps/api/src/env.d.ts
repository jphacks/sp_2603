// wrangler.jsonc に書かずダッシュボードで設定する変数は wrangler types が拾わないので、ここで宣言する。
// 設定し忘れることもあるので省略可能にしておく。
interface DashboardVars {
  AWAY_THRESHOLD_MINUTES?: string;
}

interface Env extends DashboardVars {}

declare namespace Cloudflare {
  interface Env extends DashboardVars {}
}
