/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_EMPLOYEE_CODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
