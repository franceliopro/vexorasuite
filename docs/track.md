# Véxora Track

O Track está disponível no Atendimento. Um administrador pode cadastrar um dispositivo simulado, registrar coordenadas e abrir a posição no mapa. Um dispositivo real emite uma chave exibida uma vez. Os dispositivos podem ser vinculados a uma equipe. Outros atendentes precisam pertencer à equipe ativa com acesso ao Atendimento. Administradores veem os dispositivos da própria empresa.

## Entrada de telemetria

O equipamento ou adaptador envia `POST /api/track/ingest` à API com `Authorization: Bearer <chave-do-dispositivo>` e `Content-Type: application/json`.

```json
{
  "eventId": "identificador-estavel-da-leitura",
  "recordedAt": "2026-11-17T15:30:00-03:00",
  "latitude": -5.19,
  "longitude": -37.34,
  "speedKph": 0,
  "battery": 90
}
```

Use a hora real da leitura e mantenha o mesmo identificador nas tentativas de reenvio. A API ignora reentregas idênticas, rejeita conteúdo diferente com o mesmo identificador e preserva a posição mais recente quando chega uma leitura atrasada. A última comunicação reflete o recebimento de uma leitura nova. A última posição usa a hora informada pela origem. Os campos de velocidade e bateria são opcionais.

## Primeiro piloto

Use o modo simulado para conferir a interface. Em seguida, selecione uma fonte real e valide a associação entre dispositivo e empresa, leitura atual, leitura atrasada e desconexão. O conector de campo deve implementar autenticação e entrega conforme a API ou protocolo da fonte escolhida. A etapa inicial usa HTTP e não provisiona um broker MQTT.

## Decisões sobre o briefing

O runtime de chatbot, as configurações de agentes e os fluxos públicos já consultam estado persistido, incluindo a configuração JSON da empresa. Uma eventual divisão em tabelas precisa migrar os dados e mudar os consumidores do runtime dentro da mesma entrega. O financeiro existente usa a integração Asaas e reconcilia eventos. O escopo de Marketing mantém produção e revisão manual conforme o foco do produto.
