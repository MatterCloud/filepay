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

var buildTransactionInputsOutputs = function(inputs, outputs) {
  let tx = new bitcoin.Transaction().from(inputs);
  if (outputs) {
    for (const output of outputs) {
      if (output.script) {
        const a = (new bitcoin.Script(output.script)).toString();
        tx.addOutput(new bitcoin.Transaction.Output({ script: a, satoshis: output.value }));
      }
    }
  }
  return tx;
}

var selectCoins = function(utxos, outputs, feeRate, changeScript, options) {
  console.log('selectCoins feeb', feeRate);
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
    connect(options).getUnspentUtxos(address, function(err, utxos) {
        if (err) {
          console.log('err', err);
          callback ? callback(err, null) : '';
          return;
        }
        if (!utxos || !utxos.length) {
          callback ? callback('Error: No available utxos', null) : '';
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
            }
          });
        }
        // select coins and provide a changeScript
        let feeb = (options.pay && options.pay.feeb) ? options.pay.feeb : 0.5;
        const coinSelectedBuiltTx = selectCoins(utxos, desiredOutputs, feeb, bitcoin.Script.fromAddress(address).toHex(), options);
        let tx = buildTransactionInputsOutputs(coinSelectedBuiltTx.inputs, coinSelectedBuiltTx.outputs);
        tx.change(address);
        let transaction = tx.sign(privateKey);
        callback(null, transaction);
      }).catch((ex) => {
        console.log('Filepay build ex', ex);
        callback(ex, null);
    })
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
    callback(null, tx)
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

  build(options, function(err, tx) {
    if (err) {
      callback(err);
      return;
    }
    let rpcaddr = (options.pay && options.pay.rpc) ? options.pay.rpc : defaults.rpc;
    axios.post(`${rpcaddr}/api/v3/main/merchants/tx/broadcast`,
      { rawtx: tx.toString() },
      buildHeader(options),
    ).then((res) => {
      callback(null, res.data.result.txid);
    }).catch((ex) => {
      console.log('filepay ex', ex);
      callback(ex, null);
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

