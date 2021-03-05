import {Event} from '../Event';
import {addAction, describeUser, World} from '../World';
import {decodeCall, getPastEvents} from '../Contract';
import {VAIController} from '../Contract/VAIController';
import {VAIControllerImpl} from '../Contract/VAIControllerImpl';
import {VToken} from '../Contract/VToken';
import {invoke} from '../Invokation';
import {
  getAddressV,
  getBoolV,
  getEventV,
  getExpNumberV,
  getNumberV,
  getPercentV,
  getStringV,
  getCoreValue
} from '../CoreValue';
import {
  AddressV,
  BoolV,
  EventV,
  NumberV,
  StringV
} from '../Value';
import {Arg, Command, View, processCommandEvent} from '../Command';
import {buildComptrollerImpl} from '../Builder/ComptrollerImplBuilder';
import {buildVAIControllerImpl} from '../Builder/VAIControllerImplBuilder';
import {VAIControllerErrorReporter} from '../ErrorReporter';
import {getVAIController, getVAIControllerImpl} from '../ContractLookup';
// import {getLiquidity} from '../Value/VAIControllerValue';
import {getVTokenV} from '../Value/VTokenValue';
import {encodedNumber} from '../Encoding';
import {encodeABI, rawValues} from "../Utils";

async function genVAIController(world: World, from: string, params: Event): Promise<World> {
  let {world: nextWorld, vaicontrollerImpl: vaicontroller, vaicontrollerImplData: vaicontrollerData} = await buildVAIControllerImpl(world, from, params);
  world = nextWorld;

  world = addAction(
    world,
    `Added VAIController (${vaicontrollerData.description}) at address ${vaicontroller._address}`,
    vaicontrollerData.invokation
  );

  return world;
};

async function setPendingAdmin(world: World, from: string, vaicontroller: VAIController, newPendingAdmin: string): Promise<World> {
  let invokation = await invoke(world, vaicontroller.methods._setPendingAdmin(newPendingAdmin), from, VAIControllerErrorReporter);

  world = addAction(
    world,
    `VAIController: ${describeUser(world, from)} sets pending admin to ${newPendingAdmin}`,
    invokation
  );

  return world;
}

async function acceptAdmin(world: World, from: string, vaicontroller: VAIController): Promise<World> {
  let invokation = await invoke(world, vaicontroller.methods._acceptAdmin(), from, VAIControllerErrorReporter);

  world = addAction(
    world,
    `VAIController: ${describeUser(world, from)} accepts admin`,
    invokation
  );

  return world;
}

async function mint(world: World, from: string, vaicontroller: VAIController, amount: NumberV): Promise<World> {
  let invokation = await invoke(world, vaicontroller.methods.mintVAI(amount.encode()), from, VAIControllerErrorReporter);

  world = addAction(
    world,
    `VAIController: ${describeUser(world, from)} borrows ${amount.show()}`,
    invokation
  );

  return world;
}

async function repay(world: World, from: string, vaicontroller: VAIController, amount: NumberV): Promise<World> {
  let invokation;
  let showAmount;

  showAmount = amount.show();
  invokation = await invoke(world, vaicontroller.methods.repayVAI(amount.encode()), from, VAIControllerErrorReporter);

  world = addAction(
    world,
    `VAIController: ${describeUser(world, from)} repays ${showAmount} of borrow`,
    invokation
  );

  return world;
}


async function liquidateVAI(world: World, from: string, vaicontroller: VAIController, borrower: string, collateral: VToken, repayAmount: NumberV): Promise<World> {
  let invokation;
  let showAmount;

  showAmount = repayAmount.show();
  invokation = await invoke(world, vaicontroller.methods.liquidateVAI(borrower, repayAmount.encode(), collateral._address), from, VAIControllerErrorReporter);

  world = addAction(
    world,
    `VAIController: ${describeUser(world, from)} liquidates ${showAmount} from of ${describeUser(world, borrower)}, seizing ${collateral.name}.`,
    invokation
  );

  return world;
}

export function vaicontrollerCommands() {
  return [
    new Command<{vaicontrollerParams: EventV}>(`
        #### Deploy

        * "VAIController Deploy ...vaicontrollerParams" - Generates a new VAIController (not as Impl)
          * E.g. "VAIController Deploy YesNo"
      `,
      "Deploy",
      [new Arg("vaicontrollerParams", getEventV, {variadic: true})],
      (world, from, {vaicontrollerParams}) => genVAIController(world, from, vaicontrollerParams.val)
    ),

    new Command<{ vaicontroller: VAIController, amount: NumberV }>(`
        #### Mint

        * "VAIController Mint amount:<Number>" - Mint the given amount of VAI as specified user
          * E.g. "VAIController Mint 1.0e18"
      `,
      "Mint",
      [
        new Arg("vaicontroller", getVAIController, {implicit: true}),
        new Arg("amount", getNumberV)
      ],
      // Note: we override from
      (world, from, { vaicontroller, amount }) => mint(world, from, vaicontroller, amount),
      { namePos: 1 }
    ),

    new Command<{ vaicontroller: VAIController, amount: NumberV }>(`
        #### Repay

        * "VAIController Repay amount:<Number>" - Repays VAI in the given amount as specified user
          * E.g. "VAIController Repay 1.0e18"
      `,
      "Repay",
      [
        new Arg("vaicontroller", getVAIController, {implicit: true}),
        new Arg("amount", getNumberV, { nullable: true })
      ],
      (world, from, { vaicontroller, amount }) => repay(world, from, vaicontroller, amount),
      { namePos: 1 }
    ),

    new Command<{ vaicontroller: VAIController, borrower: AddressV, vToken: VToken, collateral: VToken, repayAmount: NumberV }>(`
        #### Liquidate

        * "VAIController Liquidate borrower:<User> vTokenCollateral:<Address> repayAmount:<Number>" - Liquidates repayAmount of given token seizing collateral token
          * E.g. "VAIController Liquidate Geoff vBAT 1.0e18"
      `,
      "Liquidate",
      [
        new Arg("vaicontroller", getVAIController, {implicit: true}),
        new Arg("borrower", getAddressV),
        new Arg("collateral", getVTokenV),
        new Arg("repayAmount", getNumberV, { nullable: true })
      ],
      (world, from, { vaicontroller, borrower, collateral, repayAmount }) => liquidateVAI(world, from, vaicontroller, borrower.val, collateral, repayAmount),
      { namePos: 1 }
    )
  ];
}

export async function processVAIControllerEvent(world: World, event: Event, from: string | null): Promise<World> {
  return await processCommandEvent<any>("VAIController", vaicontrollerCommands(), world, event, from);
}
