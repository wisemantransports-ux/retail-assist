import fs from 'fs';
import path from 'path';

export interface BrandConfig {
  name: string;
  tagline: string;
  logo: string;
  favicon: string;
  primaryColor: string;
  accentColor: string;
  supportEmail: string;
  domain: string;
  company: string;
  socialLinks: {
    twitter?: string;
    facebook?: string;
    linkedin?: string;
  };
}

const DEFAULT_BRAND: BrandConfig = {
  name: "Retail Pro",
  tagline: "AI-Powered Customer Automation",
  logo: "/logo.png",
  favicon: "/favicon.ico",
  primaryColor: "#2563EB",
  accentColor: "#10B981",
  supportEmail: "support@example.com",
  domain: "example.com",
  company: "Your Company",
  socialLinks: {
    twitter: "",
    facebook: "",
    linkedin: ""
  }
};

const BRAND_CONFIG_PATH = path.join(process.cwd(), '.data', 'branding.json');

function ensureDataDir(): void {
  const dataDir = path.join(process.cwd(), '.data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

export function getBrand(): BrandConfig {
  try {
    ensureDataDir();
    if (fs.existsSync(BRAND_CONFIG_PATH)) {
      const data = fs.readFileSync(BRAND_CONFIG_PATH, 'utf-8');
      return { ...DEFAULT_BRAND, ...JSON.parse(data) };
    }
  } catch (error) {
    console.error('[Branding] Error reading brand config:', error);
  }
  return DEFAULT_BRAND;
}

export function saveBrand(brand: Partial<BrandConfig>): BrandConfig {
  try {
    ensureDataDir();
    const current = getBrand();
    const updated = { ...current, ...brand };
    fs.writeFileSync(BRAND_CONFIG_PATH, JSON.stringify(updated, null, 2));
    return updated;
  } catch (error) {
    console.error('[Branding] Error saving brand config:', error);
    throw error;
  }
}

