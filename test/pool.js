const truffleAssert = require('truffle-assertions');

const BigNumber = require('bignumber.js');
const Vault = artifacts.require('Vault');
const VaultFactory = artifacts.require('VaultFactory');
const VaultFactoryProxy = artifacts.require('VaultFactoryProxy');
const PoolFactory = artifacts.require('PoolFactory');
const Pool = artifacts.require('TPool');
const StubFeed = artifacts.require('StubFeed');
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
    let derivativeLived;
    let poolView;

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
    const createAndInitializePool = async (balancePrimary, balanceComplement, leveragePrimary, leverageComplement, isRepricingOn) =>{
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
          '0x0000000000000000000000000000000000000000',
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

        const tokens = await poolContract.getTokens();
        console.log('Pool Tokens : ', tokens);

        if(!isRepricingOn) {
            await poolContract.turnOffRepricing();
        }
    }
    const resetTokenRecordTo = async (tokenAddress, tokenBalance, tokenLeverage) => {
        await poolContract.resetTokenRecordTo(
          tokenAddress,
          bn(tokenBalance).times(COLLATERAL_BONE),
          bn(tokenLeverage).times(BONE_BIG),
          { from: CONTRACT_ADMIN_ACCOUNT}
        );
    }

    beforeEach(async () => {
        CONTRACT_ADMIN_ACCOUNT = accounts[0];
        USER_1 = accounts[1];
        USER_2 = accounts[2];
        console.log('CONTRACT_ADMIN_ACCOUNT ', CONTRACT_ADMIN_ACCOUNT);
        console.log('USER_1 ', USER_1);
        console.log('USER_2 ', USER_2);

        console.log('create vault');
        const vaultFactoryAddress = (await VaultFactoryProxy.deployed()).address;
        const vaultFactory = await VaultFactory.at(vaultFactoryAddress);

        derivativeLived = Math.floor(Date.now() / 1000);
        console.log(`Creating vault ${'ASSETx5'} initialized at ${derivativeLived}`);
        await vaultFactory.createVault(web3.utils.keccak256('ASSETx5'), derivativeLived);
        const lastVaultIndex = await vaultFactory.getLastVaultIndex.call();
        console.log(`Vault created index ${lastVaultIndex}`);
        vaultAddress = await vaultFactory.getVault.call(lastVaultIndex);
        console.log('Vault created ' + vaultAddress);
        await (await Vault.at(vaultAddress)).initialize([bn(1000).times(COLLATERAL_BONE)]);
        console.log('Vault initialized ' + vaultAddress);

        poolView = await PoolView.deployed();
    });

    describe('Regular swaps', async () => {
        let snapshotId;
        beforeEach(async () => {
            snapshotId = (await snapshot()).result;
            await createAndInitializePool(1000, 1000, 1.1, 0.9);
            await mintDerrivativesFor(USER_1);
        });

        afterEach(async () => {
            await revert(snapshotId);
        });

        it('PoolView config check', async () => {
            const pooInfo = await poolView.getPoolInfo.call(poolContract.address, USER_1);
            console.log('--------- Pool Info ---------');
            console.log(JSON.stringify(pooInfo));
            console.log('-----------------------------------');

        });

        it('Perform swapExactAmountIn', async () => {
            await poolContract.swapExactAmountIn(
              primaryTokenAddress,
              bn(10).times(COLLATERAL_BONE),
              complementTokenAddress,
              bn(7.29).times(1 - 0.01).times(COLLATERAL_BONE),
              { from: USER_1 }
            );
            const poolTokenData = await getPoolTokenData(poolView, poolContract);
            assert.equal(bn(poolTokenData['primaryBalance']).div(10**6).toString(), bn(1010).toString());
            assert.equal(bn(poolTokenData['primaryLeverage']).div(BONE_BIG).toString(), bn('1.0990099009900990099').toString());

            assert.equal(bn(poolTokenData['complementBalance']).div(10**6).toString(), bn( '991.932069').toString());
            assert.equal(bn(poolTokenData['complementLeverage']).div(BONE_BIG).toString(), bn( '0.89918664480641970252').toString());
        });

        it('Perform many swapExactAmountIn', async () => {
            await poolContract.swapExactAmountIn(
              primaryTokenAddress,
              bn(10).times(COLLATERAL_BONE),
              complementTokenAddress,
              bn(7.29).times(1 - 0.01).times(COLLATERAL_BONE),
              { from: USER_1 }
            );

            let poolTokenData = await getPoolTokenData(poolView, poolContract);
            assert.equal(bn(poolTokenData['primaryBalance']).div(10**6).toString(), bn(1010).toString());
            assert.equal(bn(poolTokenData['primaryLeverage']).div(BONE_BIG).toString(), bn('1.0990099009900990099').toString());

            assert.equal(bn(poolTokenData['complementBalance']).div(10**6).toString(), bn( '991.932069').toString());
            assert.equal(bn(poolTokenData['complementLeverage']).div(BONE_BIG).toString(), bn( '0.89918664480641970252').toString());

            await poolContract.swapExactAmountIn(
              complementTokenAddress,
              bn(10).times(COLLATERAL_BONE),
              primaryTokenAddress,
              bn(7.29).times(1 - 0.01).times(COLLATERAL_BONE),
              { from: USER_1 }
            );

            poolTokenData = await getPoolTokenData(poolView, poolContract);
            assert.equal(bn(poolTokenData['primaryBalance']).div(COLLATERAL_BONE).toString(), bn('997.753942').toString());
            assert.equal(bn(poolTokenData['primaryLeverage']).div(BONE_BIG).toString(), bn('1.10022511141329071291').toString());

            assert.equal(bn(poolTokenData['complementBalance']).div(COLLATERAL_BONE).toString(), bn( '1001.932069').toString());
            assert.equal(bn(poolTokenData['complementLeverage']).div(BONE_BIG).toString(), bn( '0.90019283433076738858').toString());
        });
    });

    describe('Checking boundaries', async () => {
        let snapshotId;
        beforeEach(async () => {
            snapshotId = (await snapshot()).result;
        });

        afterEach(async () => {
            await revert(snapshotId);
        });

        it('Boundary 1 price - should go through', async () => {
            await createAndInitializePool(1000, 1000, 14.11, 0.07, true);
            await mintDerrivativesFor(USER_1);

            const oracleAddress = await vaultContract.oracles(0);
            const oracleContract = await StubFeed.at(oracleAddress);

            const liveRoundAnswer = parseFloat((await oracleContract.latestAnswer.call()).toString());

            increaseTime(days(27) + hours(23) + minutes(54) - seconds(18));

            const UNV = 0.1;
            const currentPrice = (UNV * liveRoundAnswer - 5 * liveRoundAnswer) / 5 + liveRoundAnswer;
            await oracleContract.addRound(currentPrice, derivativeLived + days(27) + hours(23) + minutes(59));

            await poolContract.swapExactAmountIn(
              complementTokenAddress,
              bn(1).times(COLLATERAL_BONE),
              primaryTokenAddress,
              bn(18.76).times(1 - 0.01).times(COLLATERAL_BONE),
              { from: USER_1 }
            );

            let poolTokenData = await getPoolTokenData(poolView, poolContract);
            assert.equal(bn(poolTokenData['primaryBalance']).div(COLLATERAL_BONE).toString(), bn('804.752545').toString());
            assert.equal(bn(poolTokenData['primaryLeverage']).div(BONE_BIG).toString(), bn('17.17852743044136629602').toString());

            assert.equal(bn(poolTokenData['complementBalance']).div(COLLATERAL_BONE).toString(), bn( '1001').toString());
            assert.equal(bn(poolTokenData['complementLeverage']).div(BONE_BIG).toString(), bn( '0.07137943056943056943').toString());
        });

        it('Boundary 2 price - should revert', async () => {
            await createAndInitializePool(1000, 1000, 14.11, 0.07, true);
            await mintDerrivativesFor(USER_1);

            const oracleAddress = await vaultContract.oracles(0);
            const oracleContract = await StubFeed.at(oracleAddress);

            const liveRoundAnswer = parseFloat((await oracleContract.latestAnswer.call()).toString());

            increaseTime(days(27) + hours(23) + minutes(54) - seconds(18));

            const UNV = 0.1;
            const currentPrice = (UNV * liveRoundAnswer - 5 * liveRoundAnswer) / 5 + liveRoundAnswer;
            await oracleContract.addRound(currentPrice, derivativeLived  + days(27) + hours(23) + minutes(59));

            await truffleAssert.reverts(
              poolContract.swapExactAmountIn(
                primaryTokenAddress,
                bn(1).times(COLLATERAL_BONE),
                complementTokenAddress,
                0,
                { from: USER_1 }
              ),
              'BUP'
            );
        });

        it('Boundary 3 price - should revert', async () => {
            await createAndInitializePool(100, 100, 1, 198.9);
            await mintDerrivativesFor(USER_1);

            await truffleAssert.reverts(
              poolContract.swapExactAmountIn(
                complementTokenAddress,
                bn(10).times(COLLATERAL_BONE),
                primaryTokenAddress,
                0,
                { from: USER_1 }
              ),
              'BUP'
            );
        });

        it('Boundary 4 qMin - should revert', async () => {
            await createAndInitializePool(100, 100, 1, 100);
            await resetTokenRecordTo(complementTokenAddress, 1, 100);
            await mintDerrivativesFor(USER_1);

            //TODO: Should BOUNDARY_NON_LEVERAGED, but it is SUB_UNDERFLOW now
            await truffleAssert.reverts(
              poolContract.swapExactAmountIn(
                primaryTokenAddress,
                bn(2).times(COLLATERAL_BONE),
                complementTokenAddress,
                0,
                { from: USER_1 }
              ),
              'SUB_UNDERFLOW'
            );
        });

        it('Boundary 5 EL 1 - should revert', async () => {
            await createAndInitializePool(100, 100, 1, 1);
            await mintDerrivativesFor(USER_1);

            await truffleAssert.reverts(
              poolContract.swapExactAmountIn(
                primaryTokenAddress,
                bn(25).times(COLLATERAL_BONE),
                complementTokenAddress,
                0,
                { from: USER_1 }
              ),
              'BEXP'
            );
        });

        it('Boundary 6 EL 2 - should revert', async () => {
            await createAndInitializePool(100, 100, 1, 1);
            await mintDerrivativesFor(USER_1);

            await truffleAssert.reverts(
              poolContract.swapExactAmountIn(
                primaryTokenAddress,
                bn(25).times(COLLATERAL_BONE),
                complementTokenAddress,
                0,
                { from: USER_1 }
              ),
              'BEXP'
            );
        });

        it('Boundary 9 Fee must equal MaxFee', async () => {
            await createAndInitializePool(100, 100, 1, 2);
            await mintDerrivativesFor(USER_1);

            await truffleAssert.reverts(
              poolContract.swapExactAmountIn(
                primaryTokenAddress,
                bn(20).times(COLLATERAL_BONE),
                complementTokenAddress,
                0,
                { from: USER_1 }
              ),
              'BEXP'
            );
        });

        it('16 qMin - should revert', async () => {
            await createAndInitializePool(1000, 1000, 1, 100);
            await resetTokenRecordTo(complementTokenAddress, 10, 100);
            await mintDerrivativesFor(USER_1);

            // TODO: Should be BOUNDARY_NON_LEVERAGED, but it is SUB_UNDERFLOW
            await truffleAssert.reverts(
              poolContract.swapExactAmountIn(
                primaryTokenAddress,
                bn(13).times(COLLATERAL_BONE),
                complementTokenAddress,
                0,
                { from: USER_1 }
              ),
              'SUB_UNDERFLOW'
            );

        });
    });

    describe('Common issues', async () => {
        let snapshotId;
        beforeEach(async () => {
            snapshotId = (await snapshot()).result;
        });

        afterEach(async () => {
            await revert(snapshotId);
        });

        it('10 Revert swaps in settlement', async () => {
            await createAndInitializePool(100, 100, 1, 0.9);
            await mintDerrivativesFor(USER_1);

            increaseTime(days(28));

            await truffleAssert.reverts(
              poolContract.swapExactAmountIn(
                primaryTokenAddress,
                bn(1).times(COLLATERAL_BONE),
                complementTokenAddress,
                0,
                { from: USER_1 }
              ),
              'SETTLED'
            );
        });

        it('11 Pause & un-pause pool', async () => {
            await createAndInitializePool(100, 100, 1, 0.9);
            await mintDerrivativesFor(USER_1);

            await poolContract.swapExactAmountIn(
              primaryTokenAddress,
              bn(1).times(COLLATERAL_BONE),
              complementTokenAddress,
              0,
              { from: USER_1 }
            );

            await poolFactory.pausePool(poolAddress, {from: CONTRACT_ADMIN_ACCOUNT});

            await truffleAssert.reverts(
              poolContract.swapExactAmountIn(
                primaryTokenAddress,
                bn(1).times(COLLATERAL_BONE),
                complementTokenAddress,
                0,
                { from: USER_1 }
              ),
              'revert Pausable: paused'
            );

            await poolFactory.unpausePool(poolAddress, {from: CONTRACT_ADMIN_ACCOUNT});

            await poolContract.swapExactAmountIn(
              primaryTokenAddress,
              bn(1).times(COLLATERAL_BONE),
              complementTokenAddress,
              0,
              { from: USER_1 }
            );

            await truffleAssert.reverts(poolFactory.pausePool(poolAddress, {from: USER_1}), "");
        });

        it('12 Verify that removed liquidity contains accumulated commission', async () => {
            await createAndInitializePool(100000, 100000, 1.1, 0.9);
            await mintDerrivativesFor(USER_1);
            await mintDerrivativesFor(USER_2);

            let poolTokenData = await getPoolTokenData(poolView, poolContract);

            const oldUserPrimaryBalance = await primaryToken.methods.balanceOf(USER_2).call({from: USER_2});
            const oldUserComplementBalance = await complementToken.methods.balanceOf(USER_2).call({from: USER_2});

            const oldBalanceInPrimary = bn(oldUserPrimaryBalance)
                .times(bn(poolTokenData['primaryBalance']))
                .dividedBy(bn(poolTokenData['complementBalance']))
                .plus(bn(oldUserComplementBalance));

            await poolContract.joinPool(
              bn(500).times(POOL_DECIMALS_MULTIPLIER),
              [MAX, MAX],
              { from: USER_2 }
            );

            const data =  await poolContract.swapExactAmountIn.call(
              primaryTokenAddress,
              bn(1000).times(COLLATERAL_BONE),
              complementTokenAddress,
              0,
              { from: USER_1 }
            );

            console.log(data["tokenAmountOut"].toString());

            await poolContract.swapExactAmountIn(
              primaryTokenAddress,
              bn(1000).times(COLLATERAL_BONE),
              complementTokenAddress,
              0,
              { from: USER_1 }
            );

            await poolContract.swapExactAmountIn(
              complementTokenAddress,
              bn(806.575849).times(COLLATERAL_BONE),
              primaryTokenAddress,
              0,
              { from: USER_1 }
            );

            await poolContract.exitPool(
              bn(500).times(POOL_DECIMALS_MULTIPLIER),
              [0, 0],
              { from: USER_2 }
            );

            poolTokenData = await getPoolTokenData(poolView, poolContract);

            const currentUserPrimaryBalance = await primaryToken.methods.balanceOf(USER_2).call({from: USER_2});
            const currentUserComplementBalance = await complementToken.methods.balanceOf(USER_2).call({from: USER_2});

            const balanceInPrimary = bn(currentUserPrimaryBalance)
            .times(bn(poolTokenData['primaryBalance']))
            .dividedBy(bn(poolTokenData['complementBalance']))
            .plus(bn(currentUserComplementBalance));

            console.log(oldBalanceInPrimary.toString(), balanceInPrimary.toString());
            assert.equal(bn(oldBalanceInPrimary).comparedTo(balanceInPrimary), -1);
        });

        it('13 Add / remove liquidity in Live/Settled pools', async () => {
            await createAndInitializePool(100, 100, 1, 1);
            await mintDerrivativesFor(USER_1);

            let oldUserPrimaryBalance = await primaryToken.methods.balanceOf(USER_1).call({from: USER_1});
            let oldUserComplementBalance = await complementToken.methods.balanceOf(USER_1).call({from: USER_1});

            await poolContract.joinPool(
              bn(50).times(POOL_DECIMALS_MULTIPLIER),
              [MAX, MAX],
              { from: USER_1 }
            );

            await poolContract.exitPool(
              bn(50).times(POOL_DECIMALS_MULTIPLIER),
              [0, 0],
              { from: USER_1 }
            );

            let currentUserPrimaryBalance = await primaryToken.methods.balanceOf(USER_1).call({from: USER_1});
            let currentUserComplementBalance = await complementToken.methods.balanceOf(USER_1).call({from: USER_1});

            assert.equal(bn(oldUserPrimaryBalance).comparedTo(currentUserPrimaryBalance), 0);
            assert.equal(bn(oldUserComplementBalance).comparedTo(currentUserComplementBalance), 0);

            increaseTime(days(1) + hours(1));

            oldUserPrimaryBalance = await primaryToken.methods.balanceOf(USER_1).call({from: USER_1});
            oldUserComplementBalance = await complementToken.methods.balanceOf(USER_1).call({from: USER_1});

            await poolContract.joinPool(
              bn(50).times(POOL_DECIMALS_MULTIPLIER),
              [MAX, MAX],
              { from: USER_1 }
            );

            await poolContract.exitPool(
              bn(50).times(POOL_DECIMALS_MULTIPLIER),
              [0, 0],
              { from: USER_1 }
            );

            currentUserPrimaryBalance = await primaryToken.methods.balanceOf(USER_1).call({from: USER_1});
            currentUserComplementBalance = await complementToken.methods.balanceOf(USER_1).call({from: USER_1});

            assert.equal(bn(oldUserPrimaryBalance).comparedTo(currentUserPrimaryBalance), 0);
            assert.equal(bn(oldUserComplementBalance).comparedTo(currentUserComplementBalance), 0);

            increaseTime(days(28) + hours(1));

            oldUserPrimaryBalance = await primaryToken.methods.balanceOf(USER_1).call({from: USER_1});
            oldUserComplementBalance = await complementToken.methods.balanceOf(USER_1).call({from: USER_1});

            await poolContract.joinPool(
              bn(50).times(POOL_DECIMALS_MULTIPLIER),
              [MAX, MAX],
              { from: USER_1 }
            );

            await poolContract.exitPool(
              bn(50).times(POOL_DECIMALS_MULTIPLIER),
              [0, 0],
              { from: USER_1 }
            );

            currentUserPrimaryBalance = await primaryToken.methods.balanceOf(USER_1).call({from: USER_1});
            currentUserComplementBalance = await complementToken.methods.balanceOf(USER_1).call({from: USER_1});

            assert.equal(bn(oldUserPrimaryBalance).comparedTo(currentUserPrimaryBalance), 0);
            assert.equal(bn(oldUserComplementBalance).comparedTo(currentUserComplementBalance), 0);
        });

        it('14 Remove ALL liquidity in Live/Settled pools', async () => {
            await createAndInitializePool(100, 100, 1, 1);
            await mintDerrivativesFor(USER_1);
            await mintDerrivativesFor(USER_2);

            await poolContract.joinPool(
              bn(50).times(POOL_DECIMALS_MULTIPLIER),
              [MAX, MAX],
              { from: USER_2 }
            );

            await poolContract.swapExactAmountIn(
              primaryTokenAddress,
              bn(1).times(COLLATERAL_BONE),
              complementTokenAddress,
              0,
              { from: USER_1 }
            );

            await poolContract.swapExactAmountIn(
              complementTokenAddress,
              bn(1).times(COLLATERAL_BONE),
              primaryTokenAddress,
              0,
              { from: USER_1 }
            );

            await poolContract.exitPool(
              bn(50).times(POOL_DECIMALS_MULTIPLIER),
              [0, 0],
              { from: USER_2 }
            );

            await poolContract.exitPool(
              bn(200).times(POOL_DECIMALS_MULTIPLIER),
              [0, 0],
              { from: CONTRACT_ADMIN_ACCOUNT }
            );

            poolContract.swapExactAmountIn(
              primaryTokenAddress,
              bn(1).times(COLLATERAL_BONE),
              complementTokenAddress,
              0,
              { from: USER_1 }
            );

            // await truffleAssert.reverts(poolContract.swapExactAmountIn(
            //   primaryTokenAddress,
            //   bn(1).times(COLLATERAL_BONE),
            //   complementTokenAddress,
            //   0,
            //   { from: USER_1 }
            // ), "MAX_IN_RATIO");
        });
    });

    describe('Real tests', async () => {
        let snapshotId;
        beforeEach(async () => {
            snapshotId = (await snapshot()).result;
        });

        afterEach(async () => {
            await revert(snapshotId);
        });

        it('Method 1 problem', async () => {
            await createAndInitializePool(100, 100, 1, 1);
            await resetTokenRecordTo(primaryTokenAddress, '116.387875', '0.9167616643915871');
            await resetTokenRecordTo(complementTokenAddress, '90.033722', '1.083092965988899');
            await mintDerrivativesFor(USER_1);

            await poolContract.swapExactAmountIn(
              primaryTokenAddress,
              bn( 4.99).times(COLLATERAL_BONE),
              complementTokenAddress,
              0,
              { from: USER_1 }
            );

            const poolTokenData = await getPoolTokenData(poolView, poolContract);
            assert.equal(bn(poolTokenData['primaryBalance']).div(COLLATERAL_BONE).toString(), bn('121.377875').toString());
            assert.equal(bn(poolTokenData['primaryLeverage']).div(BONE_BIG).toString(), bn('0.92018369904729342147').toString());

            assert.equal(bn(poolTokenData['complementBalance']).div(COLLATERAL_BONE).toString(), bn( '85.697839').toString());
            assert.equal(bn(poolTokenData['complementLeverage']).div(BONE_BIG).toString(), bn( '1.08729705541349764957').toString());
        });

        it('Method 1 problem 2', async () => {
            await createAndInitializePool(10000, 10000, 1, 1);
            await resetTokenRecordTo(primaryTokenAddress, '139.859989', '2.334508035');
            await resetTokenRecordTo(complementTokenAddress, '101.175782', '0.310558194');

            await mintDerrivativesFor(USER_1);

            await poolContract.swapExactAmountIn(
              complementTokenAddress,
              bn( 8).times(COLLATERAL_BONE),
              primaryTokenAddress,
              bn(0).times(COLLATERAL_BONE),
              { from: USER_1 }
            );

            const poolTokenData = await getPoolTokenData(poolView, poolContract);
            assert.equal(bn(poolTokenData['primaryBalance']).div(COLLATERAL_BONE).toString(), bn('73.864304').toString());
            assert.equal(bn(poolTokenData['primaryLeverage']).div(BONE_BIG).toString(), bn('3.52685355296923937712').toString());

            assert.equal(bn(poolTokenData['complementBalance']).div(COLLATERAL_BONE).toString(), bn( '109.175782').toString());
            assert.equal(bn(poolTokenData['complementLeverage']).div(BONE_BIG).toString(), bn( '0.36107795408325996694').toString());
        });
    });

});
