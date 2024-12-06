const { getNamedAccounts, ethers } = require("hardhat")
const AMOUNT = ethers.parseEther("0.02")
async function getWeth() {
    const { deployer } = await getNamedAccounts()
    //call the deposit function on the Weth contract
    // we need both the abi and contract address
    //address : 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2
    const signer = await ethers.provider.getSigner()
    const iWeth = await ethers.getContractAt(
        "IWeth",
        "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
        signer,
    )
    const tx = await iWeth.deposit({ value: AMOUNT })
    await tx.wait(1)
    const wethBalance = await iWeth.balanceOf(deployer)
    console.log(`Got ${wethBalance.toString()}, Enjoy!`)
}
module.exports = { getWeth, AMOUNT }
