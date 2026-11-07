// Variables mínimas para que los módulos se carguen sin un archivo .env.
process.env.NODE_ENV = "test";
process.env.JWT_ACCESS_SECRET = "secreto-de-prueba-access";
process.env.JWT_MFA_SECRET = "secreto-de-prueba-mfa";
process.env.TAX_RATE = "0.05";
process.env.RETURN_WINDOW_DAYS = "7";
