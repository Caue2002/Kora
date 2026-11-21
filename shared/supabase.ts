// Cliente minimo do Supabase via PostgREST + RPC
// Evita dependencia pesada; usa service role apenas no servidor

import { supabaseServiceKey, supabaseUrl } from './env';

async function request(path: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(`${supabaseUrl()}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: supabaseServiceKey(),
      Authorization: `Bearer ${supabaseServiceKey()}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const corpo = await res.text().catch(() => '');
    throw new Error(`Supabase ${res.status}: ${corpo.slice(0, 300)}`);
  }
  const texto = await res.text();
  return texto ? JSON.parse(texto) : null;
}

export async function rpc<T = unknown>(fn: string, params: Record<string, unknown>): Promise<T> {
  return (await request(`rpc/${fn}`, {
    method: 'POST',
    body: JSON.stringify(params),
  })) as T;
}

export async function inserir<T = unknown>(tabela: string, dados: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${supabaseUrl()}/rest/v1/${tabela}`, {
    method: 'POST',
    headers: {
      apikey: supabaseServiceKey(),
      Authorization: `Bearer ${supabaseServiceKey()}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(dados),
  });
  if (!res.ok) {
    const corpo = await res.text().catch(() => '');
    throw new Error(`Supabase insert ${res.status}: ${corpo.slice(0, 300)}`);
  }
  return null as T;
}

export async function upsert(tabela: string, dados: Record<string, unknown>, onConflict: string): Promise<void> {
  const res = await fetch(`${supabaseUrl()}/rest/v1/${tabela}?on_conflict=${onConflict}`, {
    method: 'POST',
    headers: {
      apikey: supabaseServiceKey(),
      Authorization: `Bearer ${supabaseServiceKey()}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(dados),
  });
  if (!res.ok) {
    const corpo = await res.text().catch(() => '');
    throw new Error(`Supabase upsert ${res.status}: ${corpo.slice(0, 300)}`);
  }
}

export async function consultar<T = Record<string, unknown>>(tabela: string, query = ''): Promise<T[]> {
  return (await request(`${tabela}?${query}`)) as T[];
}
