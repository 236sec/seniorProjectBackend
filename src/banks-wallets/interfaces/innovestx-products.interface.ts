export interface InnovestXProductData {
  product: string;
  productType: string;
  decimalPlaces: number;
}

export interface InnovestXProductResponse {
  code: string;
  message: string;
  data: InnovestXProductData[];
}
