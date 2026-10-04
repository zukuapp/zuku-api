import ZukuClient, {ZukuApiError, type OperationInputs, type Content} from '@zuku/sdk';
import {ZukuGameBridge, type GameAction} from '@zuku/sdk/game-bridge';
const client=new ZukuClient({fetch:globalThis.fetch});
const create:OperationInputs['createCloudPaymentSession']={body:{projectId:'fixture-project',productId:'fixture-product',idempotencyKey:'fixture-payment-key'}};
void create;const action:GameAction='room-join';void action;void ZukuGameBridge;void ZukuApiError;
async function typed(){const result=await client.getContent('cnt_fixture');const content:Content=result.data.content;return content.title;}
void typed;
// @ts-expect-error Unknown query fields must be rejected.
client.operations.getFeeds({query:{arbitrary:3}});
// @ts-expect-error Required project name/body must be present.
client.operations.createCloudProject({});

// @ts-expect-error Login requires password and captcha even with identifier present.
client.operations.loginUser({body:{identifier:'tester'}});
// @ts-expect-error Native game type and draft status are constrained by the canonical request.
client.operations.createContent({body:{category:'jump',type:'html5',title:'Game'}});
