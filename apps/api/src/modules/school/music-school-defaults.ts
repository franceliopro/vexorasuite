/** Cursos padrão do segmento Escola de Música e Instrumentos.
 * São sugestões iniciais para o dono da escola cadastrar no catálogo.
 * Nenhum curso é criado automaticamente no banco; esta lista serve de referência
 * para preencher a gestão escolar da Fermata Music.
 */
export const MUSIC_SCHOOL_DEFAULT_COURSES = [
  { name: "Violão", kind: "COURSE", level: "Iniciante", durationLabel: "50 min", tuitionAmountCents: 25000 },
  { name: "Baixo", kind: "COURSE", level: "Iniciante", durationLabel: "50 min", tuitionAmountCents: 25000 },
  { name: "Teclado", kind: "COURSE", level: "Iniciante", durationLabel: "50 min", tuitionAmountCents: 28000 },
  { name: "Bateria", kind: "COURSE", level: "Iniciante", durationLabel: "50 min", tuitionAmountCents: 30000 },
  { name: "Sax", kind: "COURSE", level: "Iniciante", durationLabel: "50 min", tuitionAmountCents: 32000 },
  { name: "Canto", kind: "COURSE", level: "Iniciante", durationLabel: "50 min", tuitionAmountCents: 30000 },
] as const;

export type MusicSchoolDefaultCourse = (typeof MUSIC_SCHOOL_DEFAULT_COURSES)[number];

export function musicSchoolDefaultCourses(): MusicSchoolDefaultCourse[] {
  return [...MUSIC_SCHOOL_DEFAULT_COURSES];
}
