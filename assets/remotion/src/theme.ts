export const T = {
  W: 1920,
  H: 1080,
  FPS: 30,

  // 暗色科技底
  bg: '#08090c',
  bgCity: 'rgba(150,170,210,0.05)',
  bgGold: 'rgba(198,158,74,0.07)',

  // 白金卡
  card: '#fdfbf4',
  cardIvory: '#f7f1e2',
  gold: '#c9a24a',
  goldLite: '#e6cf92',
  goldDeep: '#8c6b21',
  ink: '#14151a',
  sub: '#6f6a5e',

  // 负面强调（利润被吃掉 / 绕开平台 / 治标不治本）
  danger: '#8f2b21',
} as const;

export const GOLD = '#c9a24a';
export const GOLD_LITE = '#e6cf92';
export const DARKRED = '#8f2b21';

// 系统中文字体栈（不随仓库分发字体文件）：macOS 冬青黑体 / 苹方，Linux Noto Sans CJK（apt install fonts-noto-cjk），Windows 微软雅黑
export const FONT =
  '"Hiragino Sans GB","PingFang SC","Noto Sans CJK SC","Noto Sans SC","Source Han Sans SC","Microsoft YaHei",sans-serif';
