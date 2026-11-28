/** Cursos padrão do segmento Escola de Música e Instrumentos.
 * A lista é a sugestão inicial do dono da escola: Violão, Baixo, Teclado,
 * Bateria, Sax e Canto. Outros instrumentos entram depois, pelo catálogo.
 * Nenhum dado de outra empresa é copiado: o seed é sempre tenant-scoped.
 */
export const MUSIC_SCHOOL_DEFAULT_COURSES = [
  {
    name: "Violão",
    kind: "COURSE",
    level: "Iniciante",
    durationLabel: "50 min",
    tuitionAmountCents: 25000,
    imageUrl: "https://placehold.co/600x400/fef3c7/b45309?text=Violao",
    summary: "Acordes, ritmo e afinação para tocar as primeiras músicas com confiança.",
  },
  {
    name: "Baixo",
    kind: "COURSE",
    level: "Iniciante",
    durationLabel: "50 min",
    tuitionAmountCents: 25000,
    imageUrl: "https://placehold.co/600x400/fef3c7/b45309?text=Baixo",
    summary: "Linha de baixo, tempo e groove para acompanhar a banda desde a primeira aula.",
  },
  {
    name: "Teclado",
    kind: "COURSE",
    level: "Iniciante",
    durationLabel: "50 min",
    tuitionAmountCents: 28000,
    imageUrl: "https://placehold.co/600x400/fef3c7/b45309?text=Teclado",
    summary: "Notas, escalas e coordenação das mãos em canções simples e progressivas.",
  },
  {
    name: "Bateria",
    kind: "COURSE",
    level: "Iniciante",
    durationLabel: "50 min",
    tuitionAmountCents: 30000,
    imageUrl: "https://placehold.co/600x400/fef3c7/b45309?text=Bateria",
    summary: "Postura, batidas básicas e independência para manter o ritmo da música.",
  },
  {
    name: "Sax",
    kind: "COURSE",
    level: "Iniciante",
    durationLabel: "50 min",
    tuitionAmountCents: 32000,
    imageUrl: "https://placehold.co/600x400/fef3c7/b45309?text=Sax",
    summary: "Embocadura, respiração e as primeiras notas do saxofone com exercícios curtos.",
  },
  {
    name: "Canto",
    kind: "COURSE",
    level: "Iniciante",
    durationLabel: "50 min",
    tuitionAmountCents: 30000,
    imageUrl: "https://placehold.co/600x400/fef3c7/b45309?text=Canto",
    summary: "Respiração, afinação e interpretação vocal com repertório adequado ao aluno.",
  },
] as const;

export type MusicSchoolDefaultCourse = (typeof MUSIC_SCHOOL_DEFAULT_COURSES)[number];

export function musicSchoolDefaultCourses(): MusicSchoolDefaultCourse[] {
  return [...MUSIC_SCHOOL_DEFAULT_COURSES];
}
