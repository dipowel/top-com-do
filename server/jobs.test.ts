import { describe, it, expect } from 'vitest';
import { resolveCompanyLogo } from './lib/jobs';

describe('resolveCompanyLogo · logo real de la empresa en tarjetas/JobPosting', () => {
  it('null sin companyId (vacante sin negocio vinculado — nunca se inventa un logo)', () => {
    expect(resolveCompanyLogo(null, 'data:image/webp;base64,abc')).toBeNull();
  });

  it('null con companyId pero sin avatar real (el negocio no subió imagen)', () => {
    expect(resolveCompanyLogo('company-1', null)).toBeNull();
    expect(resolveCompanyLogo('company-1', undefined)).toBeNull();
    expect(resolveCompanyLogo('company-1', '')).toBeNull();
  });

  it('URL cacheable /api/profiles/:id/avatar cuando el avatar es un data URI', () => {
    const url = resolveCompanyLogo('company-1', 'data:image/webp;base64,AAAA');
    expect(url).toBe('https://www.top.com.do/api/profiles/company-1/avatar');
  });

  it('pasa directo una URL externa http(s) ya alojada', () => {
    const url = resolveCompanyLogo('company-1', 'https://cdn.example.com/logo.png');
    expect(url).toBe('https://cdn.example.com/logo.png');
  });
});
