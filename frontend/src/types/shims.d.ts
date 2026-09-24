import "react";

declare module "react" {
  // tell TS your component accepts "perm" and "fallback"
  interface IntrinsicAttributes {
    perm?: string;
    fallback?: React.ReactNode;
  }
}
