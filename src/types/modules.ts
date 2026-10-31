export interface ModuleInfo {
  module_path: string;
  name: string;
  description?: string;
}

export interface ModuleContent {
  module_path: string;
  content: string;
}

export interface ModuleCreate extends ModuleInfo {
  content: string;
}

export interface ModuleUpdate {
  content: string;
}
