/**
 * Contratos funcionais legados dos editores de sites.
 *
 * São valores de DOM (ids pareados, testid de e2e) usados por guards e fluxos
 * externos, não classes CSS. Vivem fora dos TSX migrados para que a auditoria
 * de utilities Tailwind não confunda contratos com estilos componente.
 */
export const EDITOR_PAGE_ID = 'vx-editor-page';
export const INSPECTOR_AI_FEEDBACK_TEST_ID = 'vx-inspector-ai-feedback';
export const LAYOUT_IMAGE_INPUT_ID = 'vx-wizard-layout-image';
