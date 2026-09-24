import "axios";

declare module "axios" {
  export interface AxiosRequestConfig {
    skipRedirectOn403?: boolean;
  }
}
