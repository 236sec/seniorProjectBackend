import { TokenDocument } from 'src/tokens/schema/token.schema';

export interface InnovestXBalanceData {
  product: string;
  amount: string;
  hold: string;
  pendingDeposit: string;
  pendingWithdraw: string;
}

export interface InnovestXBalanceResponse {
  code: string;
  message: string;
  data: InnovestXBalanceData[];
}

export interface InnovestXBalanceWithTokenData extends InnovestXBalanceData {
  tokenId: TokenDocument;
}

export interface InnovestXBalanceWithTokenResponse {
  code: string;
  message: string;
  data: InnovestXBalanceWithTokenData[];
}
