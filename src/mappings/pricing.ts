/* eslint-disable prefer-const */
import { Pair, Token, Bundle } from '../types/schema'
import { BigDecimal, Address, BigInt } from '@graphprotocol/graph-ts/index'
import { ZERO_BD, factoryContract, ADDRESS_ZERO, ONE_BD, UNTRACKED_PAIRS } from './helpers'

const WNATIVE_ADDRESS = '0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83'

const USDC_AXL_WFTM_PAIR = '0xA196C7754f4ec79dE55bB5Db82187bBE82275f7f' // created block 65318511
const USDC_LZ_WFTM_PAIR = '0x90469ACbC4b6d877873CD4f1CCA54fDE8075A998' // created 65245749

export function getEthPriceInUSD(): BigDecimal {
  // fetch eth prices for each stablecoin
  let axlUSDCPair = Pair.load(USDC_AXL_WFTM_PAIR) // usdc is token0
  let lzUSDCPair = Pair.load(USDC_LZ_WFTM_PAIR) // usdc is token1

if (axlUSDCPair !== null && lzUSDCPair !== null) {
    let totalLiquidityETH = axlUSDCPair.reserve1.plus(lzUSDCPair.reserve0)
    let daiWeight = axlUSDCPair.reserve1.div(totalLiquidityETH)
    let usdcWeight = lzUSDCPair.reserve0.div(totalLiquidityETH)
    return axlUSDCPair.token0Price.times(daiWeight).plus(lzUSDCPair.token1Price.times(usdcWeight))
    // USDC is the only pair so far
  } else if (lzUSDCPair !== null) {
    return lzUSDCPair.token1Price
  } else {
    return ZERO_BD
  }
}

// token where amounts should contribute to tracked volume and liquidity
let WHITELIST: string[] = [
  WNATIVE_ADDRESS,
  '0x82f0B8B456c1A451378467398982d4834b6829c1', // MIM
  '0x28a92dde19D9989F39A49905d7C9C2FAc7799bDf', // USDC_LZ
  '0xcc1b99dDAc1a33c201a742A1851662E87BC7f22C', // USDT_LZ
  '0xf1648C50d2863f780c57849D812b4B7686031A3D', // BTC_LZ
  '0xdf5C2c48cf3E50417b31Da8aa7B6Afd0Ce30af8A', // WETH_LZ
  '0x1B6382DBDEa11d97f24495C9A90b7c88469134a4', // USDC_AXL
  '0xd226392C23fb3476274ED6759D4a478db3197d82', // USDT_AXL
  '0xD5d5350F42CB484036A1C1aF5F2DF77eAFadcAFF', // DAI_AXL
  '0x04068DA6C83AFCFA0e13ba15A6696662335D5B75', // USDC_MULTI
  '0x8D11eC38a3EB5E956B052f67Da8Bdc9bef8Abf3E', // DAI_MULTI
  '0x049d68029688eAbF473097a2fC38ef61633A3C7A', // USDT_MULTI
  '0x321162Cd933E2Be498Cd2267a90534A804051b11', // BTC_MULTI
  '0x74b23882a30290451A17c44f4F05243b6b58C76d', // WETH_MULTI
  '0x841FAD6EAe12c286d1Fd18d1d525DFfA75C7EFFE', // BOO
  '0x29b0Da86e484E1C0029B56e817912d778aC0EC69', //YFI
  '0x56ee926bD8c72B2d5fa1aF4d9E4Cbb515a1E3Adc', //SNX
  '0xb3654dc3D10Ea7645f8319668E8F54d2574FBdC8', //LINK
  '0x1E4F97b9f9F913c46F1632781732927B9019C68b', //CRV
  '0xD67de0e0a0Fd7b15dC8348Bb9BE742F3c5850454', //BNB
  '0x6c021Ae822BEa943b2E66552bDe1D2696a53fbB7', //TOMB
  '0xdc301622e621166BD8E82f2cA0A26c13Ad0BE355', //FRAX
  '0xC5e2B037D30a390e62180970B3aa4E91868764cD', //TAROT
  '0x468003B688943977e6130F4F68F23aad939a1040', //SPELL
  '0xfB98B335551a418cD0737375a2ea0ded62Ea213b', //MAI
  '0x9879aBDea01a879644185341F7aF7d8343556B7a', //TUSD
  '0x85dec8c4B2680793661bCA91a8F129607571863d', //BRUSH
  '0x40DF1Ae6074C35047BFF66675488Aa2f9f6384F3', //MATIC
]

// minimum liquidity required to count towards tracked volume for pairs with small # of Lps
let MINIMUM_USD_THRESHOLD_NEW_PAIRS = BigDecimal.fromString('100000')

// minimum liquidity for price to get tracked
let MINIMUM_LIQUIDITY_THRESHOLD_ETH = BigDecimal.fromString('2')

/**
 * Search through graph to find derived Eth per token.
 * @todo update to be derived ETH (add stablecoin estimates)
 **/
export function findEthPerToken(token: Token): BigDecimal {
  if (token.id == WNATIVE_ADDRESS) {
    return ONE_BD
  }
  // loop through whitelist and check if paired with any
  for (let i = 0; i < WHITELIST.length; ++i) {
    let pairAddress = factoryContract.getPair(Address.fromString(token.id), Address.fromString(WHITELIST[i]))
    if (pairAddress.toHexString() != ADDRESS_ZERO) {
      let pair = Pair.load(pairAddress.toHexString())
      if (pair.token0 == token.id && pair.reserveETH.gt(MINIMUM_LIQUIDITY_THRESHOLD_ETH)) {
        let token1 = Token.load(pair.token1)
        return pair.token1Price.times(token1.derivedETH as BigDecimal) // return token1 per our token * Eth per token 1
      }
      if (pair.token1 == token.id && pair.reserveETH.gt(MINIMUM_LIQUIDITY_THRESHOLD_ETH)) {
        let token0 = Token.load(pair.token0)
        return pair.token0Price.times(token0.derivedETH as BigDecimal) // return token0 per our token * ETH per token 0
      }
    }
  }
  return ZERO_BD // nothing was found return 0
}

/**
 * Accepts tokens and amounts, return tracked amount based on token whitelist
 * If one token on whitelist, return amount in that token converted to USD.
 * If both are, return average of two amounts
 * If neither is, return 0
 */
export function getTrackedVolumeUSD(
  tokenAmount0: BigDecimal,
  token0: Token,
  tokenAmount1: BigDecimal,
  token1: Token,
  pair: Pair
): BigDecimal {
  let bundle = Bundle.load('1')
  let price0 = token0.derivedETH.times(bundle.ethPrice)
  let price1 = token1.derivedETH.times(bundle.ethPrice)

  // dont count tracked volume on these pairs - usually rebass tokens
  if (UNTRACKED_PAIRS.includes(pair.id)) {
    return ZERO_BD
  }

  // if less than 5 LPs, require high minimum reserve amount amount or return 0
  if (pair.liquidityProviderCount.lt(BigInt.fromI32(5))) {
    let reserve0USD = pair.reserve0.times(price0)
    let reserve1USD = pair.reserve1.times(price1)
    if (WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
      if (reserve0USD.plus(reserve1USD).lt(MINIMUM_USD_THRESHOLD_NEW_PAIRS)) {
        return ZERO_BD
      }
    }
    if (WHITELIST.includes(token0.id) && !WHITELIST.includes(token1.id)) {
      if (reserve0USD.times(BigDecimal.fromString('2')).lt(MINIMUM_USD_THRESHOLD_NEW_PAIRS)) {
        return ZERO_BD
      }
    }
    if (!WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
      if (reserve1USD.times(BigDecimal.fromString('2')).lt(MINIMUM_USD_THRESHOLD_NEW_PAIRS)) {
        return ZERO_BD
      }
    }
  }

  // both are whitelist tokens, take average of both amounts
  if (WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
    return tokenAmount0
      .times(price0)
      .plus(tokenAmount1.times(price1))
      .div(BigDecimal.fromString('2'))
  }

  // take full value of the whitelisted token amount
  if (WHITELIST.includes(token0.id) && !WHITELIST.includes(token1.id)) {
    return tokenAmount0.times(price0)
  }

  // take full value of the whitelisted token amount
  if (!WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
    return tokenAmount1.times(price1)
  }

  // neither token is on white list, tracked volume is 0
  return ZERO_BD
}

/**
 * Accepts tokens and amounts, return tracked amount based on token whitelist
 * If one token on whitelist, return amount in that token converted to USD * 2.
 * If both are, return sum of two amounts
 * If neither is, return 0
 */
export function getTrackedLiquidityUSD(
  tokenAmount0: BigDecimal,
  token0: Token,
  tokenAmount1: BigDecimal,
  token1: Token
): BigDecimal {
  let bundle = Bundle.load('1')
  let price0 = token0.derivedETH.times(bundle.ethPrice)
  let price1 = token1.derivedETH.times(bundle.ethPrice)

  // both are whitelist tokens, take average of both amounts
  if (WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
    return tokenAmount0.times(price0).plus(tokenAmount1.times(price1))
  }

  // take double value of the whitelisted token amount
  if (WHITELIST.includes(token0.id) && !WHITELIST.includes(token1.id)) {
    return tokenAmount0.times(price0).times(BigDecimal.fromString('2'))
  }

  // take double value of the whitelisted token amount
  if (!WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
    return tokenAmount1.times(price1).times(BigDecimal.fromString('2'))
  }

  // neither token is on white list, tracked volume is 0
  return ZERO_BD
}
