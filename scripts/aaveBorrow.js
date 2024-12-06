const { ethers, getNamedAccounts, network } = require("hardhat")
const { getWeth, AMOUNT } = require("../scripts/getWeth.js")
const { networkConfig } = require("../helper-hardhat-config")

const BORROW_MODE = 2 // Variable borrow mode. Stable was disabled.

async function main() {
    await getWeth()
    const { deployer } = await getNamedAccounts()
    const lendingPool = await getLendingPool(deployer)
    const wethTokenAddress = networkConfig[network.config.chainId].wethToken

    await approveErc20(wethTokenAddress, lendingPool.target, AMOUNT, deployer)
    console.log("Depositing WETH...")
    await lendingPool.deposit(wethTokenAddress, AMOUNT, deployer, 0)
    console.log("Deposited!")

    // Getting your borrowing stats
    let { availableBorrowsETH, totalDebtETH } = await getBorrowUserData(lendingPool, deployer)
    const daiPrice = await getDaiPrice()

    // Convert BigInt to number safely for calculation
    const availableBorrowsETHNumber = Number(ethers.formatEther(availableBorrowsETH))
    const daiPriceNumber = Number(ethers.formatEther(daiPrice))
    const amountDaiToBorrow = availableBorrowsETHNumber * 0.95 * (1 / daiPriceNumber)

    const amountDaiToBorrowWei = ethers.parseEther(amountDaiToBorrow.toString())

    console.log(`You can borrow ${amountDaiToBorrow.toString()} DAI`)

    await borrowDai(
        networkConfig[network.config.chainId].daiToken,
        lendingPool,
        amountDaiToBorrowWei,
        deployer,
    )
    await getBorrowUserData(lendingPool, deployer)

    await repay(
        amountDaiToBorrowWei,
        networkConfig[network.config.chainId].daiToken,
        lendingPool,
        deployer,
    )
    await getBorrowUserData(lendingPool, deployer)
}

async function repay(amount, daiAddress, lendingPool, account) {
    await approveErc20(daiAddress, lendingPool.target, amount, account)
    const repayTx = await lendingPool.repay(daiAddress, amount, BORROW_MODE, account)
    await repayTx.wait(1)
    console.log("Repaid!")
}

async function borrowDai(daiAddress, lendingPool, amountDaiToBorrow, account) {
    const borrowTx = await lendingPool.borrow(
        daiAddress,
        amountDaiToBorrow,
        BORROW_MODE,
        0,
        account,
    )
    await borrowTx.wait(1)
    console.log("You've borrowed!")
}

async function getDaiPrice() {
    const daiEthPriceFeed = await ethers.getContractAt(
        "AggregatorV3Interface",
        networkConfig[network.config.chainId].daiEthPriceFeed,
    )
    const price = (await daiEthPriceFeed.latestRoundData())[1]
    console.log(`The DAI/ETH price is ${price.toString()}`)
    return price
}

async function approveErc20(erc20Address, spenderAddress, amount, signer) {
    const erc20Token = await ethers.getContractAt(
        "IERC20",
        erc20Address,
        await ethers.getSigner(signer),
    )
    const txResponse = await erc20Token.approve(spenderAddress, amount)
    await txResponse.wait(1)
    console.log("Approved!")
}

async function getLendingPool(account) {
    const lendingPoolAddressesProvider = await ethers.getContractAt(
        "ILendingPoolAddressesProvider",
        networkConfig[network.config.chainId].lendingPoolAddressesProvider,
        await ethers.getSigner(account),
    )
    const lendingPoolAddress = await lendingPoolAddressesProvider.getLendingPool()
    const lendingPool = await ethers.getContractAt(
        "ILendingPool",
        lendingPoolAddress,
        await ethers.getSigner(account),
    )
    return lendingPool
}

async function getBorrowUserData(lendingPool, account) {
    const { totalCollateralETH, totalDebtETH, availableBorrowsETH } =
        await lendingPool.getUserAccountData(account)

    console.log(`You have ${ethers.formatEther(totalCollateralETH)} worth of ETH deposited.`)
    console.log(`You have ${ethers.formatEther(totalDebtETH)} worth of ETH borrowed.`)
    console.log(`You can borrow ${ethers.formatEther(availableBorrowsETH)} worth of ETH.`)

    return { availableBorrowsETH, totalDebtETH }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
