/** Cursos padrão da modalidade Aulas particulares.
 * A lista é a sugestão inicial: Violão, Baixo, Teclado, Bateria, Sax, Canto,
 * Musicoterapia, Musicalização Infantil e Mentoria, Workshop e Oficinas.
 * Outros cursos entram depois, pelo catálogo. Imagens no formato 16:9.
 * Nenhum dado de outra empresa é copiado: o seed é sempre tenant-scoped.
 */
export const MUSIC_SCHOOL_DEFAULT_COURSES = [
  {
    name: "Violão",
    kind: "COURSE",
    level: "Iniciante",
    durationLabel: "50 min",
    tuitionAmountCents: 38000,
    imageUrl: "https://placehold.co/1200x675/fef3c7/b45309?text=Violao",
    summary: "Acordes, ritmo e afinação para tocar as primeiras músicas com confiança.",
  },
  {
    name: "Baixo",
    kind: "COURSE",
    level: "Iniciante",
    durationLabel: "50 min",
    tuitionAmountCents: 38000,
    imageUrl: "https://placehold.co/1200x675/fef3c7/b45309?text=Baixo",
    summary: "Linha de baixo, tempo e groove para acompanhar a banda desde a primeira aula.",
  },
  {
    name: "Teclado",
    kind: "COURSE",
    level: "Iniciante",
    durationLabel: "50 min",
    tuitionAmountCents: 38000,
    imageUrl: "https://placehold.co/1200x675/fef3c7/b45309?text=Teclado",
    summary: "Notas, escalas e coordenação das mãos em canções simples e progressivas.",
  },
  {
    name: "Bateria",
    kind: "COURSE",
    level: "Iniciante",
    durationLabel: "50 min",
    tuitionAmountCents: 38000,
    imageUrl: "https://placehold.co/1200x675/fef3c7/b45309?text=Bateria",
    summary: "Postura, batidas básicas e independência para manter o ritmo da música.",
  },
  {
    name: "Sax",
    kind: "COURSE",
    level: "Iniciante",
    durationLabel: "50 min",
    tuitionAmountCents: 38000,
    imageUrl: "https://placehold.co/1200x675/fef3c7/b45309?text=Sax",
    summary: "Embocadura, respiração e as primeiras notas do saxofone com exercícios curtos.",
  },
  {
    name: "Canto",
    kind: "COURSE",
    level: "Iniciante",
    durationLabel: "50 min",
    tuitionAmountCents: 38000,
    imageUrl: "https://placehold.co/1200x675/fef3c7/b45309?text=Canto",
    summary: "Respiração, afinação e interpretação vocal com repertório adequado ao aluno.",
  },
  {
    name: "Musicoterapia",
    kind: "COURSE",
    level: "Todos os níveis",
    durationLabel: "50 min",
    tuitionAmountCents: 90000,
    imageUrl: "https://placehold.co/1200x675/fef3c7/b45309?text=Musicoterapia",
    summary: "Sessões musicais para bem-estar, comunicação, movimento e inclusão.",
  },
  {
    name: "Musicalização Infantil",
    kind: "COURSE",
    level: "Iniciante",
    durationLabel: "50 min",
    tuitionAmountCents: 43000,
    imageUrl: "https://placehold.co/1200x675/fef3c7/b45309?text=Musicalizacao",
    summary: "Sons, ritmo, cantigas e movimento para estimular a musicalidade na infância.",
  },
  {
    name: "Mentoria, Workshop e Oficinas",
    kind: "COURSE",
    level: "Todos os níveis",
    durationLabel: "1 hora",
    tuitionAmountCents: 70000,
    imageUrl: "https://placehold.co/1200x675/fef3c7/b45309?text=Mentoria",
    summary: "Mentoria individual, workshops e oficinas aplicadas para aprendizado prático. Valor 700,00/hora.",
  },
] as const;

export type MusicSchoolDefaultCourse = (typeof MUSIC_SCHOOL_DEFAULT_COURSES)[number];

export function musicSchoolDefaultCourses(): MusicSchoolDefaultCourse[] {
  return [...MUSIC_SCHOOL_DEFAULT_COURSES];
}
