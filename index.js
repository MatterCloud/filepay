/*
Originally forked from Unwriter's Datapay https://github.com/unwriter/datapay
Copied by MatterCloud (Matter Web Services Inc.) as base for 'filepay' development.

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation
files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy,
modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following conditions: The above copyright notice and this permission notice
shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE
WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE,
ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/
const mingo = require("mingo")
const _Buffer = require('buffer/')
const bitcoin = require('bsv');
const axios = require('axios');
const textEncoder = require('text-encoder');
const bsvCoinselect = require('bsv-coinselect');
const defaults = {
  api_key: 'abc', // https://www.mattercloud.net
  rpc: "https://api.mattercloud.net",
  fee: 400,
  feeb: 1.4,
}

/**
 * Will return the associated input scriptSig address information object
 * @return {Address|boolean}
 */
var isPublicKeyHashIn = function (script) {
  if (script.chunks.length === 2) {
    var signatureBuf = script.chunks[0].buf
    var pubkeyBuf = script.chunks[1].buf
    if (signatureBuf &&
      signatureBuf.length &&
      signatureBuf[0] === 0x30 &&
      pubkeyBuf &&
      pubkeyBuf.length
    ) {
      var version = pubkeyBuf[0]
      if ((version === 0x04 ||
        version === 0x06 ||
        version === 0x07) && pubkeyBuf.length === 65) {
        return true
      } else if ((version === 0x03 || version === 0x02) && pubkeyBuf.length === 33) {
        return true
      }
    }
  }
  return false
}

/**
 * @returns {boolean} if this is a pay to public key input script
 */
var isPublicKeyIn = function (script) {
  if (script.chunks.length === 1) {
    var signatureBuf = script.chunks[0].buf
    if (signatureBuf &&
      signatureBuf.length &&
      signatureBuf[0] === 0x30) {
      return true
    }
  }
  return false
}
/**
 * Builds a scriptSig (a script for an input) that signs a public key output script.
 *
 * @param {Signature|Buffer} signature - a Signature object, or the signature in DER canonical encoding
 * @param {number=} sigtype - the type of the signature (defaults to SIGHASH_ALL)
 */
var buildPublicKeyIn = function (signature, sigtype) {
  // $.checkArgument(signature instanceof Signature || Buffer.isBuffer(signature))
  // $.checkArgument(_.isUndefined(sigtype) || _.isNumber(sigtype))
  if (signature instanceof bitcoin.Signature) {
    signature = signature.toBuffer()
  }
  var script = new Script()
  script.add(Buffer.concat([
    signature,
    Buffer.from([(sigtype || bitcoin.Signature.SIGHASH_ALL) & 0xff])
  ]))
  return script
}

/**
 * @returns {boolean} if this is a public key output script
 */
var isPublicKeyOut = function (script) {
  if (script.chunks.length === 2 &&
    script.chunks[0].buf &&
    script.chunks[0].buf.length &&
    script.chunks[1].opcodenum === bitcoin.Opcode.OP_CHECKSIG) {
    var pubkeyBuf = script.chunks[0].buf
    var version = pubkeyBuf[0]
    var isVersion = false
    if ((version === 0x04 ||
      version === 0x06 ||
      version === 0x07) && pubkeyBuf.length === 65) {
      isVersion = true
    } else if ((version === 0x03 || version === 0x02) && pubkeyBuf.length === 33) {
      isVersion = true
    }
    if (isVersion) {
      return PublicKey.isValid(pubkeyBuf)
    }
  }
  return false
}

/**
 * @returns {boolean} if this is a pay to pubkey hash output script
 */
var isPublicKeyHashOut = function (script) {
  return !!(script.chunks.length === 5 &&
    script.chunks[0].opcodenum === bitcoin.Opcode.OP_DUP &&
    script.chunks[1].opcodenum === bitcoin.Opcode.OP_HASH160 &&
    script.chunks[2].buf &&
    script.chunks[2].buf.length === 20 &&
    script.chunks[3].opcodenum === bitcoin.Opcode.OP_EQUALVERIFY &&
    script.chunks[4].opcodenum === bitcoin.Opcode.OP_CHECKSIG)
}

/**
 * Builds a scriptSig (a script for an input) that signs a public key hash
 * output script.
 *
 * @param {Buffer|string|PublicKey} publicKey
 * @param {Signature|Buffer} signature - a Signature object, or the signature in DER canonical encoding
 * @param {number=} sigtype - the type of the signature (defaults to SIGHASH_ALL)
 */
var buildPublicKeyHashIn = function (publicKey, signature, sigtype) {
  // $.checkArgument(signature instanceof Signature || Buffer.isBuffer(signature))
  // $.checkArgument(_.isUndefined(sigtype) || _.isNumber(sigtype))

  // Assume Signature object hack
  //if (signature instanceof bitcoin.Signature) {
    signature = signature.toBuffer()
  //}
  var script = new bitcoin.Script()
    .add(Buffer.concat([
      signature,
      Buffer.from([(sigtype || bitcoin.Signature.SIGHASH_ALL) & 0xff])
    ]))
    .add(new bitcoin.PublicKey(publicKey).toBuffer())
  return script
}

/**
 * Detect and sign p2pkh or p2pk inputs
 *
 * @param {*} tx Transaction for signature
 * @param {*} index Input index
 * @param {*} satoshis Satoshi for input
 * @param {*} script Script for input
 * @param {*} key Signing key
 */
var signStandard = function(tx, index, satoshis, script, key) {
  let unlockingScript;
  const privKey = new bitcoin.PrivateKey(key);
  const pubKey = privKey.publicKey;
  const sigtype = bitcoin.crypto.Signature.SIGHASH_ALL | bitcoin.crypto.Signature.SIGHASH_FORKID;
  const flags = bitcoin.Script.Interpreter.SCRIPT_VERIFY_MINIMALDATA | bitcoin.Script.Interpreter.SCRIPT_ENABLE_SIGHASH_FORKID | bitcoin.Script.Interpreter.SCRIPT_ENABLE_MAGNETIC_OPCODES | bitcoin.Script.Interpreter.SCRIPT_ENABLE_MONOLITH_OPCODES;
  const signature = bitcoin.Transaction.sighash.sign(tx, privKey, sigtype, index, script, new bitcoin.crypto.BN(satoshis), flags);
  if (isPublicKeyOut(script)) {
    unlockingScript = buildPublicKeyIn(signature, sigtype);
  } else if (isPublicKeyHashOut(script)) {
    unlockingScript = buildPublicKeyHashIn(pubKey, signature, sigtype);
  } else {
    throw new Error('Non-standard script');
  }
  return unlockingScript;
}

/**
 * sign p2pkh-like input. Convenience function
 *
 * @param {*} tx Transaction for signature
 * @param {*} index Input index
 * @param {*} satoshis Satoshi for input
 * @param {*} script Script for input
 * @param {*} key Signing key
 */
var signStandardLike = function(tx, index, satoshis, script, key) {
  const privKey = new bitcoin.PrivateKey(key);
  const pubKey = privKey.publicKey;
  const sigtype = bitcoin.crypto.Signature.SIGHASH_ALL | bitcoin.crypto.Signature.SIGHASH_FORKID;
  const flags = bitcoin.Script.Interpreter.SCRIPT_VERIFY_MINIMALDATA | bitcoin.Script.Interpreter.SCRIPT_ENABLE_SIGHASH_FORKID | bitcoin.Script.Interpreter.SCRIPT_ENABLE_MAGNETIC_OPCODES | bitcoin.Script.Interpreter.SCRIPT_ENABLE_MONOLITH_OPCODES;
  const signature = bitcoin.Transaction.sighash.sign(tx, privKey, sigtype, index, script, new bitcoin.crypto.BN(satoshis), flags);
  return buildPublicKeyHashIn(pubKey, signature, sigtype);
}
/**
 * Custom signing of a transaction similar to bsv.js 1.5.3.
 *
 * The difference is that we first "sign" the inputs with `unlockingScript` function return.
 * After the inputs with a provided `unlockingScript` are paired with the unlocking scripts, then
 * attempt to apply the provided `key` against all other inputs (checking script types p2pkh, p2pk, etc)
 *
 * This provides enough functionality to use any custom locking script UTXO as inputs.
 *
 * @param {*} tx Transaction to sign
 * @param {*} txoutMapToUnlockingScript - Map `txid-outputIndex` -> function(tx, prevTxId, outputIndex): Script
 * @param {*} key Private key to sign any inputs that do not have a manually provided unlocking script
 */
var signCustom = function(tx, txoutMapToUnlockingScript, key) {
  // Apply any manual unlocking scripts if there utxos with unlockingScript function
  for (let i = 0; i < tx.inputs.length; i++) {
    const prevTxId = tx.inputs[i].prevTxId.toString('hex');
    const outputIndex = tx.inputs[i].outputIndex;
    const hasUnlockingScript = txoutMapToUnlockingScript.get(`${prevTxId}-${outputIndex}`);
    if (!hasUnlockingScript) {
      continue;
    }
    tx.inputs[i].setScript(hasUnlockingScript(tx, i, tx.inputs[i].output.satoshis, tx.inputs[i].output.script, key));
  }
  // Apply the defaults if any
  for (let i = 0; i < tx.inputs.length; i++) {
    const prevTxId = tx.inputs[i].prevTxId.toString('hex');
    const outputIndex = tx.inputs[i].outputIndex;
    const hasUnlockingScript = txoutMapToUnlockingScript.get(`${prevTxId}-${outputIndex}`);
    // Ignore if there is a locking script
    if (hasUnlockingScript) {
      continue;
    }
    tx.inputs[i].setScript(signStandard(tx, i, tx.inputs[i].output.satoshis, tx.inputs[i].output.script, key));
  }
  return tx;
}

var dedupUtxosPreserveRequiredIfFound = function(inputs) {
  // Standardize up the inputs bcause some libriares need 'amount' and some 'value'
  let modifiedInputs = [];
  // Add all required inputs first
  let map = new Map();
  for (const input of inputs) {
    if (input.required) {
      modifiedInputs.push(input);
      map.set(input.txid + '-' + input.outputIndex, true);
    }
  }
  // Add all non-required inputs
  for (const input of inputs) {
    // Skip duplicate utxos
    if (map.get(input.txid + '-' + input.outputIndex)) {
      continue;
    }
    if (!input.required) {
      modifiedInputs.push(input);
      map.set(input.txid + '-' + input.outputIndex, true);
    }
  }
  return modifiedInputs;
}
var calculateFee = function(inputs, outputs) {
  let inputSum = 0;
  let outputSum = 0;
  if (inputs) {
    for (const input of inputs) {
      inputSum += input.value;
    }
  }
  if (outputs) {
    for (const output of outputs) {
      outputSum += output.value;
    }
  }
  return inputSum - outputSum;
}

var buildTransactionInputsOutputs = function(inputs, outputs) {
  // Standardize up the inputs bcause some libriares need 'amount' and some 'value'
  let modifiedInputs = [];
  let map = new Map();
  for (const input of inputs) {
    // Skip duplicate utxos
    if (map.get(input.txid + '-' + input.outputIndex)) {
      continue;
    }
    modifiedInputs.push(Object.assign({}, input, {
      amount: input.value / 100000000,
      satoshis: input.value
    }));
    map.set(input.txid + '-' + input.outputIndex, true);
  }
  let tx = new bitcoin.Transaction().from(modifiedInputs);
  if (outputs) {
    for (const output of outputs) {
      if (output.script) {
        const a = (new bitcoin.Script(output.script)).toString();
        tx.addOutput(new bitcoin.Transaction.Output({ script: a, satoshis: output.value }));
      }
    }
  }

  // Safety check to ensure fee never goes greater than 0.1 BSV
  let sumInputValues = 0;
  let sumOutputValues = 0;
  for (const input of tx.inputs) {
    sumInputValues += input.output.satoshis;
  }
  for (const output of tx.outputs) {
    sumOutputValues += output.satoshis;
  }

  // --------------------------------------------------
  // The fee would be greater than 0.1 BSV
  // There's no need for that big of a fee since miners are mining 10MB tx max size at 0.5 sat/byte
  if (!isNaN(sumInputValues) && !isNaN(sumOutputValues) &&
    sumInputValues >= 0 && sumOutputValues >= 0 &&
    (sumInputValues - sumOutputValues <= 10000000)) {
    return tx;
  }
  // Limit can be changed in future.  For now throw Error
  throw new Error('Too large fee error');
}

var selectCoins = function(utxos, outputs, feeRate, changeScript) {
  return bsvCoinselect(utxos, outputs, feeRate, changeScript);
}

// The end goal of 'build' is to create a hex formated transaction object
// therefore this function must end with _tx() for all cases
// and return a hex formatted string of either a tranaction or a script
var build = function(options, callback) {
  let script = null;
  if (options.tx) {
    // if tx exists, check to see if it's already been signed.
    // if it's a signed transaction
    // and the request is trying to override using 'data' or 'pay',
    // we should throw an error
    let tx = new bitcoin.Transaction(options.tx)
    // transaction is already signed
    if (tx.inputs.length > 0 && tx.inputs[0].script) {
      if (options.pay || options.data) {
        callback(new Error("the transaction is already signed and cannot be modified"))
        return;
      }
    }
    return tx;
  } else {
    // construct script only if transaction doesn't exist
    // if a 'transaction' attribute exists, the 'data' should be ignored to avoid confusion
    if (options.data) {
      script = _script(options)
    }
  }

  // Instantiate pay
  if (options.pay && options.pay.key) {
    // key exists => create a signed transaction
    let key = options.pay.key;
    const privateKey = new bitcoin.PrivateKey(key);
    const address = privateKey.toAddress();

    /**
     *
     * Construct a transaction for the utxos, taking care to include required=true utxos if needed.
     *
     * @param {*} err Whether error happened, if so then callback immediately
     * @param {*} utxos - Provided  utxos manual and discovered.
     * @param {*} innerCallback Callback on error or success
     */
    const processWithUtxos = function(err, utxos, innerCallback) {
      if (err) {
        innerCallback ? innerCallback(err, null, null) : '';
        return;
      }
      if (!utxos || !utxos.length) {
        innerCallback ? innerCallback('Error: No available utxos', null, null) : '';
        return;
      }
      if (options.pay.filter && options.pay.filter.q && options.pay.filter.q.find) {
        let f = new mingo.Query(options.pay.filter.q.find)
        utxos = utxos.filter(function(item) {
          return f.test(item)
        })
      }
      const desiredOutputs = [];
      if (script) {
        desiredOutputs.push({ script: script.toHex(), value: 0 });
      }

      // Handle multiple outputs of varying types
      if (options.pay.to && Array.isArray(options.pay.to)) {
        options.pay.to.forEach(function(receiver) {
          if (receiver.address) {
            desiredOutputs.push({
              script: bitcoin.Script.fromAddress(receiver.address).toHex(),
              value: receiver.value
            });
          } else if (receiver.data) {
            desiredOutputs.push({
              script: _script({ data: receiver.data }).toHex(),
              value: receiver.value
            });
          } else if (receiver.script) {
            desiredOutputs.push({
              script: receiver.script,
              value: receiver.value
            });
          } else {
            throw new Error('Invalid to. Required script and value');
          }
        });
      }
      // select coins and provide a changeScript
      let feeb = (options.pay && options.pay.feeb) ? options.pay.feeb : 0.5;
      // My default the payment key is the change script
      let changeScriptHex = bitcoin.Script.fromAddress(address).toHex();
      // Allow the user to override it with their own address
      if (options.pay.changeAddress) {
        changeScriptHex = bitcoin.Script.fromAddress(options.pay.changeAddress).toHex();
      }
      // Also allow the user to override it with a changeScript (in hex)
      if (options.pay.changeScript) {
        // Sanity check to make sure it's well formed valid script
        changeScriptHex = bitcoin.Script.fromHex(options.pay.changeScript).toHex();
      }
      const coinSelectedBuiltTx = selectCoins(dedupUtxosPreserveRequiredIfFound(utxos), desiredOutputs, feeb, changeScriptHex);
      if (!coinSelectedBuiltTx.inputs || !coinSelectedBuiltTx.outputs) {
        innerCallback('Insufficient input utxo', null, null);
        return;
      }
      let tx = buildTransactionInputsOutputs(coinSelectedBuiltTx.inputs, coinSelectedBuiltTx.outputs);
      let actualFee = calculateFee(coinSelectedBuiltTx.inputs, coinSelectedBuiltTx.outputs);
      // Track a mapping  of txid+index -> unlockingScript functions
      const utxoUnlockingMap = new Map();
      for (const utxo of utxos) {
        if (utxo.unlockingScript) {
          utxoUnlockingMap.set(utxo.txid + '-' + utxo.outputIndex, utxo.unlockingScript);
        }
      }
      // Do not use bitcoin.Transaction.sign because it makes assumptions about the inputs
      // Instead we sign each input in turn using sensible defaults and calling back to unlockingScript functions if provided.
      let transaction = signCustom(tx, utxoUnlockingMap, key);
      innerCallback(null, transaction, actualFee);
    }

    // If custom inputs are provided, then attempt to use them
    if (options.pay.inputs && Array.isArray(options.pay.inputs)) {
      processWithUtxos(null, options.pay.inputs, function(err, tx, fee) {
        // No error and the tx is valid given just the manual inputs
        // Therefore return because we had everything we needed with the manual inputs to fulfil total fee/outputs
        if (!err && tx) {
          callback(null, tx, fee);
          return;
        }
        // On the other hand, the manual inputs are inadequate, then lookup extra utxos
        connect(options).getUnspentUtxos(address, function(err, utxos) {
          if (err) {
            callback(err, null, null);
            return;
          }
          // Merge the provided utxos with the retrieved ones then
          let mergedUtxos = utxos.concat(options.pay.inputs);
          processWithUtxos(null, mergedUtxos, function(err, tx, fee) {
            callback(err, tx, fee);
            return;
          });
        })
        .catch((ex) => {
            console.log('Filepay build ex', ex);
            callback(ex, null, null);
        });
      });
    } else {
      // No manual utxos provided, lookup all of them
      connect(options).getUnspentUtxos(address, function(err, utxos) {
        processWithUtxos(err, utxos, function(err, tx, fee) {
          callback(err, tx, fee);
        });
      })
      .catch((ex) => {
          console.log('Filepay build ex', ex);
          callback(ex, null, null);
      });
    }
  } else {

    const desiredOutputs = [];
    if (script) {
      desiredOutputs.push({ script: script, value: 0 });
    }

    // Handle multiple outputs of varying types
    if (options.pay && options.pay.to && Array.isArray(options.pay.to)) {
      options.pay.to.forEach(function(receiver) {
        if (receiver.address) {
          desiredOutputs.push({
            script: bitcoin.Script.fromAddress(receiver.address).toHex(),
            value: receiver.value
          });
        } else if (receiver.data) {
          desiredOutputs.push({
            script: _script({ data: receiver.data }).toHex(),
            value: receiver.value
          });
        } else if (receiver.script) {
          desiredOutputs.push({
            script: receiver.script,
            value: receiver.value
          });
        }
      });
    }
    // key doesn't exist => create an unsigned transaction
    let fee = (options.pay && options.pay.fee) ? options.pay.fee : defaults.fee;
    let tx = new bitcoin.Transaction(options.tx).fee(fee);
    for (const out of desiredOutputs) {
      tx.addOutput(new bitcoin.Transaction.Output({
        script: out.script,
        satoshis: out.value
      }));
    }
    callback(null, tx, null)
  }
}

var buildHeader = function(options) {
  if (!options) {
    return {
      headers: {
        'Content-Type': 'application/json'
      }
    };
  }
  if (options && options.pay && options.pay.api_key) {
    return {
      headers: {
        'Content-Type': 'application/json',
        api_key: options.pay.api_key
      }
    };
  }
  if (options && options.api_key) {
    return {
      headers: {
        'Content-Type': 'application/json',
        api_key: options.api_key
      }
    };
  }
  return {}
};

var send = function(options, callback) {
  if (!callback) {
    callback = function() {};
  }

  build(options, function(err, tx, fee) {
    if (err) {
      callback(err);
      return;
    }
    let rpcaddr = (options.pay && options.pay.rpc) ? options.pay.rpc : defaults.rpc;
    axios.post(`${rpcaddr}/api/v3/main/merchants/tx/broadcast`,
      { rawtx: tx.toString() },
      buildHeader(options),
    ).then((res) => {
      callback(null, res.data.result.txid, fee, tx.toString());
    }).catch((ex) => {
      console.log('filepay ex', ex);
      callback(ex, tx.hash, fee, tx.toString());
    });
  })
}
// compose script
var _script = function(options) {
  var s = null;
  if (options.data) {
    if (Array.isArray(options.data)) {
      s = new bitcoin.Script();
      if (!options.hasOwnProperty("safe")) {
        options.safe = true;
      }
      if (options.safe) {
        s.add(bitcoin.Opcode.OP_FALSE);
      }
      // Add op_return
      s.add(bitcoin.Opcode.OP_RETURN);
      options.data.forEach(function(item) {
        // add push data
        if (item.constructor.name === 'ArrayBuffer') {
          let buffer = _Buffer.Buffer.from(item)
          s.add(buffer)
        } else if (item.constructor.name === 'Buffer') {
          s.add(item)
        } else if (typeof item === 'string') {
          if (/^0x/i.test(item)) {
            // ex: 0x6d02
            s.add(Buffer.from(item.slice(2), "hex"))
          } else {
            // ex: "hello"
            s.add(Buffer.from(item))
          }
        } else if (typeof item === 'object' && item.hasOwnProperty('op')) {
          s.add({ opcodenum: item.op })
        }
      })
    } else if (typeof options.data === 'string') {
      // Exported transaction
      s = bitcoin.Script.fromHex(options.data);
    }
  }
  return s;
}

/**
 * Get unspent utxos for an address wrapper
 *
 * @param {*} options
 */
var apiClient = function(options) {
  return {
    getUnspentUtxos: async (address, callback) => {
      let rpcaddr = (options && options.pay && options.pay.rpc) ? options.pay.rpc : defaults.rpc;
      return axios.get(`${rpcaddr}/api/v3/main/address/${address}/utxo`,
        buildHeader(options),
      )
      .then((response) => {
        if (callback) {
          callback(null, response.data)
        }
        return response.data;
      }).catch((err) => {
        console.log(err);
        if (callback) {
          callback(err);
        }
        return err;
      })
    },
  };
}

var callbackAndResolve = function (resolveOrReject, data, callback) {
  if (callback) {
      callback(data);
  }
  if (resolveOrReject) {
      return resolveOrReject(data)
  }
}

var hexEncode = function(str) {
  function buf2hex(buffer) {
    const hexStr = Array.prototype.map.call(new Uint8Array(buffer), (x) => ('00' + x.toString(16)).slice(-2)).join('');
    return hexStr.toLowerCase();
  }
  const checkHexPrefixRegex = /^0x(.*)/i;
  const match = checkHexPrefixRegex.exec(str);
  if (match) {
      return str;
  } else {
      let enc = new textEncoder.TextEncoder().encode(str);
      return buf2hex(enc)
  }
}

var hexEncodeIfNeeded = function(data) {
  if (!data) {
      return '0x00';
  }
  const checkHexPrefixRegex = /^0x(.*)/i;
  const match = checkHexPrefixRegex.exec(data);
  if (match && match[1]) {
      return data.toLowerCase();
  }
  return '0x' + hexEncode(data).toLowerCase();
}

var isUtf8 = function(encoding) {
  if (!encoding || /\s*/i.test(encoding)) {
      return true;
  }
  return /utf\-?8$/i.test(encoding);
}

var buildFile = function(request, callback) {
    return new Promise((resolve, reject) => {
        if (!request.file) {
            return callbackAndResolve(resolve, {
                success: false,
                message: 'file required'
            }, callback);
        }

        if (!request.file.content) {
            return callbackAndResolve(resolve, {
                success: false,
                message: 'content required'
            }, callback);
        }

        if (!request.file.contentType) {
            return callbackAndResolve(resolve, {
                success: false,
                message: 'contentType required'
            }, callback);
        }

        try {
            let encoding = request.file.encoding ? request.file.encoding : 'utf-8';
            if (isUtf8(encoding)) {
                encoding = 'utf-8';
            }
            let args = [
                '0x' + Buffer.from("19HxigV4QyBv3tHpQVcUEQyq1pzZVdoAut").toString('hex'),
                hexEncodeIfNeeded(request.file.content),
                hexEncodeIfNeeded(request.file.contentType),
                hexEncodeIfNeeded(encoding)
            ];
            const hasFileName = request.file.name && request.file.name !== '';
            let filename = request.file.name ? request.file.name : '0x00';
            args.push(hexEncodeIfNeeded(filename));
            if (request.file.tags) {
                request.file.tags.map((tag) => args.push(hexEncodeIfNeeded(tag)));
            }
            // Attach signatures if they are provided
            if (request.signatures && Array.isArray(request.signatures)) {
                for (const signatureKey of request.signatures) {
                    if (!signatureKey.key || /^\s*$/.test(signatureKey.key)) {
                        return callbackAndResolve(resolve, {
                            success: false,
                            message: 'signature key required'
                        }, callback);
                    }
                    const identityPrivateKey = new filepay.bsv.PrivateKey(signatureKey.key);
                    const identityAddress = identityPrivateKey.toAddress().toLegacyAddress();
                    args.push('0x' + Buffer.from('|').toString('hex'));
                    const opReturnHexArray = Utils.buildAuthorIdentity({
                        args: args,
                        address: identityAddress,
                        key: signatureKey.key,
                        indexes: signatureKey.indexes ? signatureKey.indexes : undefined
                    });
                    args = args.concat(opReturnHexArray);
                }
            }
            return callbackAndResolve(resolve, {
                success: true,
                data: args,
            }, callback);

        } catch (ex) {
            console.log('ex', ex);
            callbackAndResolve(resolve, {
                success: false,
                message: ex.message ? ex.message : ex.toString()
            }, callback)
        }
    });
}

var putFile = async (request, callback) => {
    if (!request.pay || !request.pay.key || request.pay.key === '') {
        return new Promise((resolve) => {
            return callbackAndResolve(resolve, {
                success: false,
                message: 'key required'
            }, request.callback);
        });
    }

    const buildResult = await buildFile(request);
    if (!buildResult.success) {
        return new Promise((resolve) => {
            callbackAndResolve(resolve, {
                success: false,
                message: buildResult.message
            }, request.callback);
        });
    }
    const newArgs = [];
    for (const i of buildResult.data) {
        const checkHexPrefixRegex = /^0x(.*)/i;
        const match = checkHexPrefixRegex.exec(i);
        if (match && match[1]) {
            newArgs.push(i);
        } else {
            newArgs.push('0x' + i);
        }
    }
    return send({
        safe: true,
        data: newArgs,
        pay: request.pay,
        rpc: request.rpc,
        api_key: request.api_key
    }, callback);
}
/**
 * Queue a request to cache the file on BitcoinFiles.org and settle on BSV blockchain after payment is received.
 * The response contains a 'payment_sats_needed' field and an 'payment_address` that can be used to pay for queuing into a tx.
 * @param {*} requestRequest { name: 'filename', data: '0933923...', encoding: 'hex' }
 * @param {*} callback
 */
var queueFile = async (request, callback) => {
  var formData = new FormData();
  formData.append("file", Buffer.from(request.data, request.encoding));
  axios.post(`${rpcaddr}/upload`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      }
    ).then((res) => {
      callback(null, res.data);
    }).catch((ex) => {
      callback(ex, null);
    });
}

var connect = function(options) {
  return apiClient(options);
}

var data2script = function(scriptArray) {
  if (!scriptArray || !Array.isArray(scriptArray)) {
    return '';
  }
  var s = new bitcoin.Script();
  s.add(bitcoin.Opcode.OP_FALSE);
  s.add(bitcoin.Opcode.OP_RETURN);
  scriptArray.forEach(function(item) {
    // add push data
    if (item.constructor.name === 'ArrayBuffer') {
      let buffer = _Buffer.Buffer.from(item)
      s.add(buffer)
    } else if (item.constructor.name === 'Buffer') {
      s.add(item)
    } else if (typeof item === 'string') {
      if (/^0x/i.test(item)) {
        // ex: 0x6d02
        s.add(Buffer.from(item.slice(2), "hex"))
      } else {
        // ex: "hello"
        s.add(Buffer.from(item))
      }
    } else if (typeof item === 'object' && item.hasOwnProperty('op')) {
      s.add({ opcodenum: item.op })
    }
  })
  return s;
}


module.exports = {
  putFile: putFile,
  queueFile: queueFile,
  build: build,
  send: send,
  bsv: bitcoin,
  connect: connect,
  data2script: data2script,
  coinselect: bsvCoinselect,
  signStandard: signStandard,
  signStandardLike: signStandardLike
}

/*
// Post File or object
require('filepay').putFile({
   file: {
      content: 'Hello world!',
      contentType: 'text/plain',
      encoding: 'utf8',
      name: 'hello.txt'
   },
   pay: { key: "58Jd09..." }
});

// Post OP_RETURN strings or hex data
require('filepay').send({
   data: [ "0x6d02", "Hello world!"],
   pay: {
      api_key: "goes here",
      key: "58Jd09...",
   }
});
*/

/*

filepay.send({
  data: ["0x6d02", "hello from filepay"],
  pay: {
    key: "....",
    to: [
      // Attach another OP_RETURN for a text file
      {
        "data": ["19HxigV4QyBv3tHpQVcUEQyq1pzZVdoAut", "Hello from inside a text file", "text/plain"],
        "value": 0
      },
      // Pay a public address
      {
        "address": "131xY3twRUJ1Y9Z9jJFKGLUa4SAdRJppcW",
        "value": 546
      },
      // Pay arbitrary script
      {
        "script": "OP_DUP OP_HASH160 20 0x717ff56bc729556b30b456e91b68faec709993ac OP_EQUALVERIFY OP_CHECKSIG",
        "value": 546
      }
    ]
  }
});
*/
// Example: https://whatsonchain.com/tx/25418da84000051d43776370cc671278241177dcff424c7618fc9dc5b6fa7fdf

/*
filepay.send({
  data: ["hello world"],
  pay: {
    key: privKey,
    inputs: [
      {
        "txid": "19b99a8b4a8c8c1d2e3130945aeda7d8070104af2ff9320667d95fd1a311ea12",
        "value": 786,
        "script": "76a914161e9c31fbec37d9ecb297bf4b814c6e189dbe5288ac",
        "outputIndex": 2,
        "required": true,
        "unlockingScript": function(tx, index, satoshis, script, key) {
          // Optional. Provide a acustom unlocking script for this custom utxo
          // ...
          // Convenience method 'filepay.signStandard' provided for standard p2pkh/p2pk
          // return filepay.signStandard(tx, index, satoshis, script, key);
          return bsv.Script();
        }
      },
      {
        "txid": "2f65137399213afad9804662329cf2351e46a624f9ab61a3a9e45adedb1cebbe",
        "value": 9305,
        "script": "76a914161e9c31fbec37d9ecb297bf4b814c6e189dbe5288ac",
        "outputIndex": 2,
        "required": true
        // assumes filepay.signStandard is used for unlockingScript
      }
    ]
  }
});
*/


/*
filepay.send({
  data: ["hello world"],
  pay: {
    key: privKey,
    inputs: [
      {
        "txid": "19b99a8b4a8c8c1d2e3130945aeda7d8070104af2ff9320667d95fd1a311ea12",
        "value": 786,
        "script": "76a914161e9c31fbec37d9ecb297bf4b814c6e189dbe5288ac",
        "outputIndex": 2,
        "required": true,
        "unlockingScript": function(tx, index, satoshis, script, key) {
          // Optional. Provide a acustom unlocking script for this custom utxo
          // ...
          // Convenience method 'filepay.signStandard' provided for standard p2pkh/p2pk
          return filepay.signStandard(tx, index, satoshis, script, key);
        }
      }
    ]
  }
});
*/

/*
filepay.send({
  data: ["hello world"],
  pay: {
    key: privKey,
    inputs: [
      {
        "txid": "19b99a8b4a8c8c1d2e3130945aeda7d8070104af2ff9320667d95fd1a311ea12",
        "value": 786,
        "script": "76a914161e9c31fbec37d9ecb297bf4b814c6e189dbe5288ac",
        "outputIndex": 2,
        "required": true,
        "unlockingScript": function(tx, index, satoshis, script, key) {
          // Optional. Provide a acustom unlocking script for this custom utxo
          // ...
          // Convenience method 'filepay.signStandard' provided for standard p2pkh/p2pk
          // return filepay.signStandard(tx, index, satoshis, script, key);

          // ---------- CUSTOM UNLOCKING EXAMPLE ---------
          // To unlock any custom p2pkh-like locking script....
          return filepay.signStandardLike(tx, index, satoshis, script, key);
        }
      }
    ]
  }
});
*/