import { NextResponse } from 'next/server';
import { getClientAndContext } from '../_helpers';

export async function GET() {
  const { supabase, ctx } = await getClientAndContext();
  if (!ctx) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { data, error } = await supabase
    .from('physio_clients')
    .select('*')
    .eq('business_id', ctx.businessId)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ clients: data });
}

export async function POST(request: Request) {
  const { supabase, ctx } = await getClientAndContext();
  if (!ctx) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const body = await request.json();
  const {
    nombre,
    email,
    telefono,
    fecha_nacimiento,
    nivel_fisico = 'principiante',
    objetivo = 'rehabilitacion',
    dias_disponibles = [],
    notas,
    pathologies = [],
    pain_entries = [],
  } = body;

  if (!nombre?.trim()) {
    return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 });
  }

  // Crear cliente
  const { data: client, error: clientError } = await supabase
    .from('physio_clients')
    .insert({
      business_id: ctx.businessId,
      nombre: nombre.trim(),
      email: email || null,
      telefono: telefono || null,
      fecha_nacimiento: fecha_nacimiento || null,
      nivel_fisico,
      objetivo,
      dias_disponibles,
      notas: notas || null,
    })
    .select('id')
    .single();

  if (clientError || !client) {
    return NextResponse.json({ error: clientError?.message ?? 'Error al crear paciente' }, { status: 500 });
  }

  // Insertar patologías si las hay
  if (pathologies.length > 0) {
    const pathRows = pathologies.map((p: { nombre: string; zona_corporal: string; fecha_diagnostico?: string; notas?: string }) => ({
      business_id: ctx.businessId,
      client_id: client.id,
      nombre: p.nombre,
      zona_corporal: p.zona_corporal,
      fecha_diagnostico: p.fecha_diagnostico || null,
      notas: p.notas || null,
    }));
    await supabase.from('pathologies').insert(pathRows);
  }

  // Insertar mapa de dolor si hay entradas
  if (pain_entries.length > 0) {
    const painRows = pain_entries.map((p: { zona_corporal: string; mecanica: string; nivel: number }) => ({
      business_id: ctx.businessId,
      client_id: client.id,
      zona_corporal: p.zona_corporal,
      mecanica: p.mecanica,
      nivel: p.nivel,
    }));
    await supabase.from('pain_map').insert(painRows);
  }

  return NextResponse.json({ client: { id: client.id } }, { status: 201 });
}
