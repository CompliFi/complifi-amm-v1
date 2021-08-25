const truffleAssert = require('truffle-assertions');

const BigNumber = require('bignumber.js');
const DerivativeSpecification = artifacts.require('DerivativeSpecification');
const Vault = artifacts.require('Vault');
const VaultFactory = artifacts.require('VaultFactory');
const VaultFactoryProxy = artifacts.require('VaultFactoryProxy');
const PoolFactory = artifacts.require('PoolFactory');
const Pool = artifacts.require('TPool');
const PermanentLiquidityPoolView = artifacts.require('PermanentLiquidityPoolView');
const StubFeed = artifacts.require('StubFeed');

const DesignatedPoolRegistry = artifacts.require('DesignatedPoolRegistry');
const RolloverStrategy = artifacts.require('RolloverStrategy');
const PermanentLiquidityPool = artifacts.require('PermanentLiquidityPool');

const PoolView = artifacts.require('PoolView');

const increaseTime = (addSeconds) => new Promise((resolve, reject) => {
    web3.currentProvider.send(
      [{jsonrpc: "2.0", method: "evm_increaseTime", params: [addSeconds], id: 0},
          {jsonrpc: "2.0", method: "evm_mine", params: [], id: 0}
      ],
      function (error, result) {
          if (error) {
              reject(error);
          } else {
              resolve(result);
          }
      }
    );
});

const snapshot = () => new Promise((resolve, reject) => {
    //web3.currentProvider.sendAsync(
    web3.currentProvider.send(
      {jsonrpc: "2.0", method: "evm_snapshot", params: [], id: 0},
      function (error, result) {
          if (error) {
              reject(error);
          } else {
              resolve(result);
          }
      }
    );
});

const revert = (id) => new Promise((resolve, reject) => {
    //web3.currentProvider.sendAsync(
    web3.currentProvider.send(
      {jsonrpc: "2.0", method: "evm_revert", params: [id], id: 0},
      function (error, result) {
          if (error) {
              reject(error);
          } else {
              resolve(result);
          }
      }
    );
});

const seconds = (amount) => amount;
const minutes = (amount) => amount * seconds(60);
const hours = (amount) => amount * minutes(60);
const days = (amount) => amount * hours(24);
const months = (amount) => amount * days(30);


const erc20Abi = require('./Abi/ERC20PresetMinter.json').abi;

const bn = (num) => new BigNumber(num);
const BONE_DECIMALS = 26;
const BONE = 10 ** BONE_DECIMALS;
const BONE_BIG = bn(1).times(BONE);
const POOL_DECIMALS_MULTIPLIER = bn(1).times(10**18);
const COLLATERAL_BONE = bn(1).times(10 ** 6);
const MAX = web3.utils.toTwosComplement(-1);

async function getPoolTokenData(poolView, poolContract) {
    const poolTokenData = await poolView.getPoolTokenData.call(poolContract.address);
    console.log('--------- Pool Token Data ---------');
    console.log('primaryBalance ', bn(poolTokenData['primaryBalance']).div(COLLATERAL_BONE).toString());
    console.log('primaryLeverage ', bn(poolTokenData['primaryLeverage']).div(BONE_BIG).toString());
    console.log('complementBalance ', bn(poolTokenData['complementBalance']).div(COLLATERAL_BONE).toString());
    console.log('complementLeverage ', bn(poolTokenData['complementLeverage']).div(BONE_BIG).toString());
    console.log('lpTotalSupply ', bn(poolTokenData['lpTotalSupply']).div(BONE_BIG).toString());
    console.log('-----------------------------------');
    return poolTokenData;
}

contract('Integration', (accounts) => {
    let CONTRACT_ADMIN_ACCOUNT;
    let USER_1;
    let USER_2;
    let poolFactory;
    let poolAddress;
    let poolContract;
    let vaultAddress;
    let vaultContract;
    let collateralTokenAddress;
    let collateralToken;
    let primaryTokenAddress;
    let primaryToken;
    let complementTokenAddress;
    let complementToken;
    let poolView;
    let derivativeSpecification;
    let designatedPoolRegistry;
    let rolloverStrategy;
    let plpView;

    const createVault = async (derivativeLived) => {
        console.log('create vault');
        const vaultFactoryAddress = (await VaultFactoryProxy.deployed()).address;
        const vaultFactory = await VaultFactory.at(vaultFactoryAddress);

        console.log(`Creating vault ${'ASSETx5'} initialized at ${derivativeLived}`);
        await vaultFactory.createVault(web3.utils.keccak256('ASSETx5'), derivativeLived);
        const lastVaultIndex = await vaultFactory.getLastVaultIndex.call();
        console.log(`Vault created index ${lastVaultIndex}`);
        vaultAddress = await vaultFactory.getVault.call(lastVaultIndex);
        console.log('Vault created ' + vaultAddress);
        await (await Vault.at(vaultAddress)).initialize([bn(1000).times(COLLATERAL_BONE)]);
        console.log('Vault initialized ' + vaultAddress);
    }

    const mintDerrivativesFor = async (user) => {
        const collateralAmount = bn(5000).times(COLLATERAL_BONE);
        const collateralAmountToMint = bn(2000).times(COLLATERAL_BONE);
        const mintedAmount = collateralAmountToMint.dividedBy(2);

        assert.equal('0', (await collateralToken.methods.balanceOf(user).call({from: user})).toString());

        await collateralToken.methods
        .mint(user, collateralAmount)
        .send({from: user});

        assert.equal(collateralAmount.toString(), (await collateralToken.methods.balanceOf(user).call({from: user})).toString());

        // Approve Collateral For vault
        await collateralToken.methods
        .approve(vaultAddress, MAX)
        .send({ from: user });

        // Mint Derivatives
        await vaultContract.mint(collateralAmountToMint, { from: user });

        await primaryToken.methods
        .approve(poolContract.address, MAX)
        .send({ from: user });

        await complementToken.methods
        .approve(poolContract.address, MAX)
        .send({ from: user });

        assert.equal(collateralAmount.minus(collateralAmountToMint).toString(), (await collateralToken.methods.balanceOf(user).call({from: user})).toString());
        assert.equal(mintedAmount.toString(), (await primaryToken.methods.balanceOf(user).call({from: user})).toString());
        assert.equal(mintedAmount.toString(), (await complementToken.methods.balanceOf(user).call({from: user})).toString());
    }

    const createPool = async () =>{
        console.log('create pool');

        poolFactory = await PoolFactory.deployed();
        await poolFactory.newPool(vaultAddress, web3.utils.keccak256('x5Repricer'), 0, 0, 0, { from: CONTRACT_ADMIN_ACCOUNT });
        const lastPoolIndex = await poolFactory.getLastPoolIndex.call();
        console.log('Pool created index ' + lastPoolIndex);
        poolAddress = await poolFactory.getPool.call(lastPoolIndex);
        console.log('Pool created ' + poolAddress);

        poolContract = await Pool.at(poolAddress);
        vaultContract = await Vault.at(vaultAddress);

        collateralTokenAddress = await vaultContract.collateralToken();
        primaryTokenAddress = await vaultContract.primaryToken();
        complementTokenAddress = await vaultContract.complementToken();

        collateralToken = new web3.eth.Contract(erc20Abi, collateralTokenAddress);
        primaryToken = new web3.eth.Contract(erc20Abi, primaryTokenAddress);
        complementToken = new web3.eth.Contract(erc20Abi, complementTokenAddress);

        console.log('Set Pool Fee');
        const baseFee = (0.005 * BONE).toString();
        const maxFee = (0.25 * BONE).toString();
        const feeAmp = 10;
        await poolContract.setFeeParams(
          baseFee,
          maxFee,
          feeAmp,
          feeAmp,
          { from: CONTRACT_ADMIN_ACCOUNT}
        );

        const tokens = await poolContract.getTokens();
        console.log('Pool Tokens : ', tokens);
    }

    const finalizePool = async (plp, balancePrimary, balanceComplement, leveragePrimary, leverageComplement, isRepricingOn) =>{
        // Finalize Pool by controller
        // Mint Collateral Tokens for Admin
        await collateralToken.methods
        .mint(CONTRACT_ADMIN_ACCOUNT, bn(balancePrimary).times(10).times(COLLATERAL_BONE))
        .send({ from: CONTRACT_ADMIN_ACCOUNT });

        // Approve Collateral For vault
        await collateralToken.methods
        .approve(vaultAddress, MAX)
        .send({ from: CONTRACT_ADMIN_ACCOUNT });

        // Mint Derivatives
        await vaultContract.mint(bn(balancePrimary).times(4).times(COLLATERAL_BONE).integerValue(), { from: CONTRACT_ADMIN_ACCOUNT });


        console.log('Finalize Pool');
        // 2. Finalize Pool

        const qMin = (1 * Math.pow(10, 6)).toString();
        const pMin = (0.01 * BONE).toString();
        const exposureLimit = (0.2 * BONE).toString();
        const volatility1 = (1 * BONE).toString();
        const volatility2 = (1 * BONE).toString();

        await primaryToken.methods
        .approve(poolContract.address, MAX)
        .send({ from: CONTRACT_ADMIN_ACCOUNT });

        await complementToken.methods
        .approve(poolContract.address, MAX)
        .send({ from: CONTRACT_ADMIN_ACCOUNT });

        await poolContract.finalize(
          plp,
          bn(balancePrimary).times(COLLATERAL_BONE),
          bn(leveragePrimary).times(BONE_BIG),
          bn(balanceComplement).times(COLLATERAL_BONE),
          bn(leverageComplement).times(BONE_BIG),
          exposureLimit,
          exposureLimit,
          pMin,
          qMin,
          volatility1,
          volatility2,
          { from: CONTRACT_ADMIN_ACCOUNT}
        );

        console.log('Pool Finalized');

        if(!isRepricingOn) {
            await poolContract.turnOffRepricing();
        }
    }


    beforeEach(async () => {
        CONTRACT_ADMIN_ACCOUNT = accounts[0];
        USER_1 = accounts[1];
        USER_2 = accounts[2];
        console.log('CONTRACT_ADMIN_ACCOUNT ', CONTRACT_ADMIN_ACCOUNT);
        console.log('USER_1 ', USER_1);
        console.log('USER_2 ', USER_2);

        poolView = await PoolView.deployed();


        derivativeSpecification = await DerivativeSpecification.deployed();

        designatedPoolRegistry = await DesignatedPoolRegistry.new();
        DesignatedPoolRegistry.setAsDeployed(designatedPoolRegistry);
        console.log(`DesignatedPoolRegistry: ${designatedPoolRegistry.address}`);

        rolloverStrategy = await RolloverStrategy.new();
        RolloverStrategy.setAsDeployed(rolloverStrategy);
        console.log(`RolloverStrategy: ${rolloverStrategy.address}`);

        plpView = await PermanentLiquidityPoolView.new();
        PermanentLiquidityPoolView.setAsDeployed(plpView);
        console.log(`PermanentLiquidityPoolView: ${plpView.address}`);
    });

    describe('Checking boundaries', async () => {
        let snapshotId;
        beforeEach(async () => {
            snapshotId = (await snapshot()).result;
        });

        afterEach(async () => {
            await revert(snapshotId);
        });

        it('Balanced rollover', async () => {
            const derivativeLived = Math.floor(Date.now() / 1000);
            await createVault(derivativeLived);
            await createPool();
            await finalizePool("0x0000000000000000000000000000000000000000", 250, 250, 1, 1);

            assert.equal(await poolContract.controller(), "0x0000000000000000000000000000000000000000");
            assert.equal(await poolContract.swappable(), true);

            permanentLiquidityPool = await PermanentLiquidityPool.new(
              derivativeSpecification.address,
              designatedPoolRegistry.address,
              rolloverStrategy.address,
              poolContract.address
            );
            PermanentLiquidityPool.setAsDeployed(permanentLiquidityPool);
            console.log(`PermanentLiquidityPool: ${permanentLiquidityPool.address}`);

            let plpInfo = await plpView.getPoolInfo(permanentLiquidityPool.address, USER_1);
            console.log(JSON.stringify(plpInfo));

            assert.equal(
              await permanentLiquidityPool.name(),
              'ASSETx5 Leveraged Token PLP'
            );

            assert.equal(
              await permanentLiquidityPool.symbol(),
              'ASSETx5-PLP'
            );

            await mintDerrivativesFor(USER_1);

            await poolContract.joinPool(
              bn(500).times(POOL_DECIMALS_MULTIPLIER),
              [MAX, MAX],
              { from: USER_1 }
            );

            await poolContract.approve(
              permanentLiquidityPool.address,
              MAX,
              { from: USER_1 }
            );

            await permanentLiquidityPool.delegate(bn(500).times(POOL_DECIMALS_MULTIPLIER), { from: USER_1 });

            plpInfo = await plpView.getPoolInfo(permanentLiquidityPool.address, USER_1);
            console.log(JSON.stringify(plpInfo));

            const poolTokenData = await getPoolTokenData(poolView, poolContract);
            assert.equal(
              bn(poolTokenData['lpTotalSupply']).div(POOL_DECIMALS_MULTIPLIER).minus(bn(500)).toString(),
              bn(await permanentLiquidityPool.balanceOf(USER_1)).div(POOL_DECIMALS_MULTIPLIER).toString()
            );

            assert.equal(
              bn(await poolContract.balanceOf(USER_1)).div(POOL_DECIMALS_MULTIPLIER).toString(),
              0
            );


            const previousPoolContract = poolContract;

            increaseTime(days(28));

            await createVault(derivativeLived + days(28));
            await createPool();
            await finalizePool(permanentLiquidityPool.address, 250, 250, 1, 1)
            await designatedPoolRegistry.setDesignatedPool(derivativeSpecification.address, poolContract.address);

            assert.equal(await poolContract.controller(), permanentLiquidityPool.address );
            assert.equal(await poolContract.swappable(), false );

            await permanentLiquidityPool.rollOver([0],{ from: USER_1 });

            assert.equal(await poolContract.controller(), permanentLiquidityPool.address );
            assert.equal(await poolContract.swappable(), true );

            assert.equal(
              bn(await previousPoolContract.balanceOf(permanentLiquidityPool.address)).div(POOL_DECIMALS_MULTIPLIER).toString(),
              0
            );

            assert.equal(
              bn(poolTokenData['lpTotalSupply']).div(POOL_DECIMALS_MULTIPLIER).minus(bn(500)).toString(),
              bn(await permanentLiquidityPool.balanceOf(USER_1)).div(POOL_DECIMALS_MULTIPLIER).toString()
            );


            await permanentLiquidityPool.unDelegate(bn(500).times(POOL_DECIMALS_MULTIPLIER), { from: USER_1 });

            assert.equal(
              bn(await permanentLiquidityPool.balanceOf(USER_1)).div(POOL_DECIMALS_MULTIPLIER).toString(),
              0
            );

            assert.equal(
              bn(await permanentLiquidityPool.totalSupply()).toString(),
              0
            );

            assert.equal(
              bn(await poolContract.balanceOf(USER_1)).div(POOL_DECIMALS_MULTIPLIER).toString(),
              500
            );
        });
    });
});
