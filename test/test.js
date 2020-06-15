 require('dotenv').config()
const assert = require('assert');
const bitcoin = require('bsv')
const filepay = require('../index');
const bsvCoinselect = filepay.coinselect;
// Private Key for Demo Purpose Only
const privKey = 'KxPpaGmowYWcSuGSLdt6fCLiRAJRcWCpke4B8Gsf59hghQ6AKvwV'; //process.env.privKey
const address = new bitcoin.PrivateKey(privKey).toAddress()
var options = {
  api_key: '',
}
describe('filepay', function() {
  beforeEach(function(done) {

    filepay.connect(options).getUnspentUtxos(address, function(err, utxos) {
      if (err) {
        console.log("Error: ", err)
      } else {
        utxoSize = utxos.length
      }
      done();
    })
  })

  describe('build', function() {
    describe('safe as default', function() {
      it('safe as default', function(done) {
        const options = {
          data: [{op: 78}, "hello world"]
        }
        filepay.build(options, function(err, tx) {
          let generated = tx.toObject()
          let s = new bitcoin.Script(generated.outputs[0].script).toString()
          assert(s.startsWith("OP_0 OP_RETURN OP_PUSHDATA4 1818585099"))
          done()
        });
      })
      it('set safe true', function(done) {
        const options = {
          safe: true,
          data: [{op: 78}, "hello world"]
        }
        filepay.build(options, function(err, tx) {
          let generated = tx.toObject()
          let s = new bitcoin.Script(generated.outputs[0].script).toString()
          assert(s.startsWith("OP_0 OP_RETURN OP_PUSHDATA4 1818585099"))
          done()
        });
      })
      it('set safe false', function(done) {
        const options = {
          safe: false,
          data: [{op: 78}, "hello world"]
        }
        filepay.build(options, function(err, tx) {
          let generated = tx.toObject()
          let s = new bitcoin.Script(generated.outputs[0].script).toString()
          assert(s.startsWith("OP_RETURN OP_PUSHDATA4 1818585099"))
          done()
        });
      })
    })
    describe('data only', function() {
      it('opcode', function(done) {
        const options = {
          data: [{op: 78}, "hello world"]
        }
        filepay.build(options, function(err, tx) {
          let generated = tx.toObject()
          let s = new bitcoin.Script(generated.outputs[0].script).toString()
          assert(s.startsWith("OP_0 OP_RETURN OP_PUSHDATA4 1818585099 0x6c6f20776f726c64"))
          done()
        });
      })
      it('opcode 2', function(done) {
        const options = {
          data: ["0x6d02", "hello world", {op: 78}, "blah blah blah * 10^100"]
        }
        filepay.build(options, function(err, tx) {
          let generated = tx.toObject()
          let s = new bitcoin.Script(generated.outputs[0].script).toString()
          assert(s.startsWith("OP_0 OP_RETURN 2 0x6d02 11 0x68656c6c6f20776f726c64 OP_PUSHDATA4 1634492951"))
          done()
        });
      })
      it('push data array', function(done) {
        const options = {
          data: ["0x6d02", "hello world"]
        }
        filepay.build(options, function(err, tx) {
          let generated = tx.toObject();
          // no input (since no one has signed yet)
          assert.equal(generated.inputs.length, 0)
          // output has one item (only OP_RETURN)
          assert.equal(generated.outputs.length, 1)
          // the only existing output is a script
          assert(generated.outputs[0].script);
          // uses the default fee of 400
          assert(generated.fee <= 400)

          done()
        });
      })
      it('hex string that represents script', function(done) {
        const options = {
          data: "6a04366430320b68656c6c6f20776f726c64"
        }
        filepay.build(options, function(err, tx) {
          let generated = tx.toObject();
          // no input (since no one has signed yet)
          assert.equal(generated.inputs.length, 0)
          // output has one item (only OP_RETURN)
          assert.equal(generated.outputs.length, 1)
          // the only existing output is a script
          assert(generated.outputs[0].script);
          // uses the default fee of 400
          assert(generated.fee <= 400)

          done()
        });
      })
      it('Buffer', function(done) {
        const options = {
          data: [Buffer.from("abc"), "hello world"]
        }
        filepay.build(options, function(err, tx) {
          let generated = tx.toObject();
          // no input (since no one has signed yet)
          assert.equal(generated.inputs.length, 0)
          // output has one item (only OP_RETURN)
          assert.equal(generated.outputs.length, 1)
          // the only existing output is a script
          assert(generated.outputs[0].script);
          // uses the default fee of 400
          assert(generated.fee <= 400)

          done()
        });
      })
    })
    describe('pay only', function() {
      it('to', function(done) {
        const address = new bitcoin.PrivateKey(privKey).toAddress()
        const options = {
          pay: {
            key: privKey,
            to: [{ address: address, value: 546 }]
          }
        }
        filepay.build(options, function(err, tx) {
          // If only 'key' is included, it will use the default values for
          // rest of the pay attributes
          // and make a transaction that sends money to oneself
          // (since no receiver is specified)
          let generated = tx.toObject();
          done()
        })
      })
      it('pay.key only currenttest', function(done) {
        const options = {
          pay: {
            key: privKey
          }
        }
        filepay.build(options, function(err, tx) {
          // If only 'key' is included, it will use the default values for
          // rest of the pay attributes
          // and make a transaction that sends money to oneself
          // (since no receiver is specified)
          let generated = tx.toObject();
          // input length utxoSize => from the user specifiec by the private key
         //  assert.equal(generated.inputs.length, utxoSize)
          // contains a 'changeScript'
          assert(generated.changeScript)

          // output length 1 => the output points to the sender by default
          assert.equal(generated.outputs.length, 1)
          // script is a pubkeyhashout
          let s = new bitcoin.Script(generated.outputs[0].script)
          assert(s.isPublicKeyHashOut())

          // script sends the money to the same address as the sender
          // specified by the private key
          const address = new bitcoin.PrivateKey(privKey).toAddress()
          assert.equal(address.toString(), s.toAddress().toString())

          done()
        });
      })
      it('pay.fee only', function(done) {
        const options = {
          pay: {
            fee: 100
          }
        }
        filepay.build(options, function(err, tx) {
          // if no key is included,
          // empty input (since no sender)
          // empty output (since nothing else is specified)
          let generated = tx.toObject();
          assert.equal(generated.inputs.length, 0)
          assert.equal(generated.outputs.length, 0)
          assert.equal(generated.fee, 100)
          done()
        })
      })

      /**

        pay.rpc TBD

      **/

    })

    describe('multiple mixed outputs', function() {
      it('handles pay.to single data output', function(done) {
        const options = {
          data: [{op: 78}, "hello world"],
          pay: {
            to: [
              {
                data: ['0x001244', '0x6a'],
                value: 0
              }
            ]
          }
        }
        filepay.build(options, function(err, tx) {
          let generated = tx.toObject()
          console.log('generated', generated);
          let s = new bitcoin.Script(generated.outputs[0].script).toString()
          assert.equal(s, 'OP_0 OP_RETURN OP_PUSHDATA4 1818585099 0x6c6f20776f726c64');
          let s2 = new bitcoin.Script(generated.outputs[1].script).toString()
          assert.equal(s2, 'OP_0 OP_RETURN 3 0x001244 1 0x6a');
          done()
        });
      })

      it('handles pay.to single script output', function(done) {
        const options = {
          data: [{op: 78}, "hello world"],
          pay: {
            to: [
              {
                script: '76a914801c259a527abd83a977fd90a06b22d215fcad4988ac',
                value: 0
              }
            ]
          }
        }
        filepay.build(options, function(err, tx) {
          let generated = tx.toObject()
          let s = new bitcoin.Script(generated.outputs[0].script).toString()
          assert.equal(s, 'OP_0 OP_RETURN OP_PUSHDATA4 1818585099 0x6c6f20776f726c64');
          let s2 = new bitcoin.Script(generated.outputs[1].script).toString()
          assert.equal(s2, 'OP_DUP OP_HASH160 20 0x801c259a527abd83a977fd90a06b22d215fcad49 OP_EQUALVERIFY OP_CHECKSIG');
          done()
        });
      })

      it('handles pay.to single address', function(done) {
        const options = {
          data: [{op: 78}, "hello world"],
          pay: {
            to: [
              {
                address: '1BM8eQHe1jshSTVzTdhfdBX2pqgx3ruEXo',
                value: 0
              }
            ]
          }
        }
        filepay.build(options, function(err, tx) {
          let generated = tx.toObject()
          let s = new bitcoin.Script(generated.outputs[0].script).toString()
          assert.equal(s, 'OP_0 OP_RETURN OP_PUSHDATA4 1818585099 0x6c6f20776f726c64');
          let s2 = new bitcoin.Script(generated.outputs[1].script).toString()
          assert.equal(s2, 'OP_DUP OP_HASH160 20 0x717ff56bc729556b30b456e91b68faec709993ac OP_EQUALVERIFY OP_CHECKSIG');
          done()
        });
      })
      it('handles pay.to mixed data script and address', function(done) {
        const options = {
          data: [{op: 78}, "hello world"],
          pay: {
            to: [
              {
                data: ['0x001244', '0x6a'],
                value: 0
              },
              {
                address: address,
                value: 5000
              },
              {
                script: 'OP_DUP OP_HASH160 20 0x717ff56bc729556b30b456e91b68faec709993ac OP_EQUALVERIFY OP_CHECKSIG',
                value: 1000
              }
            ]
          }
        }
        filepay.build(options, function(err, tx) {
          let generated = tx.toObject()
          let s = new bitcoin.Script(generated.outputs[0].script).toString()
          assert.equal(s, 'OP_0 OP_RETURN OP_PUSHDATA4 1818585099 0x6c6f20776f726c64');
          let s2 = new bitcoin.Script(generated.outputs[1].script).toString()
          assert.equal(s2, 'OP_0 OP_RETURN 3 0x001244 1 0x6a');
          let s3 = new bitcoin.Script(generated.outputs[2].script).toString()
          assert.equal(s3, 'OP_DUP OP_HASH160 20 0x161e9c31fbec37d9ecb297bf4b814c6e189dbe52 OP_EQUALVERIFY OP_CHECKSIG');
          done()
        });
      })
    });

    describe('data and pay', function() {
      it('both data and pay', function(done) {
        const options = {
          data: ["0x6d02", "hello world"],
          pay: {
            key: privKey
          }
        }
        filepay.build(options, function(err, tx) {
          let generated = tx.toObject();
          // input length 1 => from the user specifiec by the private key
          // assert.equal(generated.inputs.length, utxoSize)
          // contains a 'changeScript'
          assert(generated.changeScript)

          // must have two outputs
          assert.equal(generated.outputs.length, 2)

          let s1 = new bitcoin.Script(generated.outputs[0].script)
          // OP_0 OP_RETURN 2 0x6d02 11 0x68656c6c6f20776f726c64
          assert(s1.chunks[0].opcodenum === bitcoin.Opcode.OP_FALSE)
          assert(s1.chunks[1].opcodenum === bitcoin.Opcode.OP_RETURN)

          // the second script is a pubkeyhashout (change address)
          let s2 = new bitcoin.Script(generated.outputs[1].script)
          assert(s2.isPublicKeyHashOut())

          // script sends the money to the same address as the sender
          // specified by the private key
          const address = new bitcoin.PrivateKey(privKey).toAddress()
          assert.equal(address.toString(), s2.toAddress().toString())

          done()
        })
      })
      it('both data and pay and calculate correct feeb rate', function(done) {

        var txhex = '';
        for (var i = 0; i < 100; i++) {
          txhex += '0123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789'
        }
        const options = {
          data: ["0x6d02", txhex],
          pay: {
            key: privKey,
            feeb: 0.01,
          }
        }
        filepay.build(options, function(err, tx) {
          let generated = tx.toObject();
          // input length 1 => from the user specifiec by the private key
          // assert.equal(generated.inputs.length, utxoSize)
          // contains a 'changeScript'
          assert(generated.changeScript)

          // must have two outputs
          assert.equal(generated.outputs.length, 2)

          let s1 = new bitcoin.Script(generated.outputs[0].script)
          // OP_0 OP_RETURN 2 0x6d02 11 0x68656c6c6f20776f726c64
          assert(s1.chunks[0].opcodenum === bitcoin.Opcode.OP_FALSE)
          assert(s1.chunks[1].opcodenum === bitcoin.Opcode.OP_RETURN)

          // the second script is a pubkeyhashout (change address)
          let s2 = new bitcoin.Script(generated.outputs[1].script)
          assert(s2.isPublicKeyHashOut())

          // script sends the money to the same address as the sender
          // specified by the private key
          const address = new bitcoin.PrivateKey(privKey).toAddress()
          assert.equal(address.toString(), s2.toAddress().toString())
          done()
        })
      })
      /*
      it('pay.filter', function(done) {
        const options = {
          data: ["0x6d02", "hello world"],
          pay: {
            key: privKey,
            filter: {
              v: 3,
              q: {
                find: {
                }
              }
            }
          }
        }
        filepay.build(options, function(err, tx) {
          let generated = tx.toObject();

          // input length 1 => from the user specifiec by the private key
          assert.equal(generated.inputs.length, 5)
          // contains a 'changeScript'
          assert(generated.changeScript)

          // must have two outputs
          assert.equal(generated.outputs.length, 2)

          let s1 = new bitcoin.Script(generated.outputs[0].script)

          // the first output is OP_RETURN
          assert(s1.chunks[0].opcodenum, bitcoin.Opcode.OP_RETURN)

          // the second script is a pubkeyhashout (change address)
          let s2 = new bitcoin.Script(generated.outputs[1].script)
          assert(s2.isPublicKeyHashOut())

          // script sends the money to the same address as the sender
          // specified by the private key
          const address = new bitcoin.PrivateKey(privKey).toAddress()
          assert.equal(address.toString(), s2.toAddress().toString())

          done()
        })

      })
      */
    })
    describe('attach coins to data', function() {
      it('paying tip to 1 user', function(done) {
        // send to myself
        const receiver = new bitcoin.PrivateKey(privKey).toAddress()

        const options = {
          data: ["0x6d02", "hello world"],
          pay: {
            key: privKey,
            to: [{
              address: receiver,
              value: 1000
            }]
          }
        }
        filepay.build(options, function(err, tx) {
          // output has 3 items
          assert.equal(tx.outputs.length, 3)

          // 1. OP_RETURN
          let s1 = new bitcoin.Script(tx.outputs[0].script)
          assert(s1.chunks[0].opcodenum === bitcoin.Opcode.OP_FALSE)
          assert(s1.chunks[1].opcodenum === bitcoin.Opcode.OP_RETURN)
          // 2. Manual transaction output
          // the second script is a pubkeyhashout (change address)
          let s2 = new bitcoin.Script(tx.outputs[1].script)
          assert(s2.isPublicKeyHashOut())
          // the value sent is 1000
          assert.equal(tx.outputs[1].satoshis, 1000)
          // the receiver address is the address specified in pay.to
          assert.equal(s2.toAddress().toString(), bitcoin.Address(receiver).toString())

          // 3. Change address transaction output
          let s3 = new bitcoin.Script(tx.outputs[2].script)
          assert(s3.isPublicKeyHashOut())
          done()
        })
      })
      it('paying tip to 2 users', function(done) {
        // send to myself
        const receiver = new bitcoin.PrivateKey(privKey).toAddress()

        const options = {
          data: ["0x6d02", "hello world"],
          pay: {
            key: privKey,
            to: [{
              address: receiver,
              value: 1000
            }, {
              address: receiver,
              value: 2000
            }]
          }
        }
        filepay.build(options, function(err, tx) {
          // output has 4 items
          assert.equal(tx.outputs.length, 4)

          // 1. OP_RETURN
          let s1 = new bitcoin.Script(tx.outputs[0].script)
          assert(s1.chunks[0].opcodenum === bitcoin.Opcode.OP_FALSE)
          assert(s1.chunks[1].opcodenum === bitcoin.Opcode.OP_RETURN)
          // 2. Manual transaction output
          // the second script is a pubkeyhashout (change address)
          let s2 = new bitcoin.Script(tx.outputs[1].script)
          assert(s2.isPublicKeyHashOut())
          // the value sent is 1000
          assert.equal(tx.outputs[1].satoshis, 1000)
          // the receiver address is the address specified in pay.to
          assert.equal(s2.toAddress().toString(), bitcoin.Address(receiver).toString())

          // 3. Manual transaction output
          // the third script is a pubkeyhashout (change address)
          let s3 = new bitcoin.Script(tx.outputs[2].script)
          assert(s3.isPublicKeyHashOut())
          // the value sent is 1000
          assert.equal(tx.outputs[2].satoshis, 2000)
          // the receiver address is the address specified in pay.to
          assert.equal(s3.toAddress().toString(), bitcoin.Address(receiver).toString())

          // 3. Change address transaction output
          let s4 = new bitcoin.Script(tx.outputs[3].script)
          assert(s4.isPublicKeyHashOut())
          done()
        })
      })
    })
    describe('tx', function() {
      /*
      describe('importing unsigned tx', function() {
        it('tx only', function(done) {
          // 1. build
          const options = {
            data: ["0x6d02", "hello world"]
          }
          filepay.build(options, function(err, original_tx) {
            // 2. export
            let exportedTx = original_tx.toString()
            // exported transaction is string
            assert.equal(typeof exportedTx, "string")
            // 3. re-import
            filepay.build({
              tx: exportedTx
            }, function(err, imported_tx) {
              // the imported transaction should equal the original transaction
              assert.equal(imported_tx.toString(), original_tx.toString())
              done()
            })
          })
        })
        it('tx + data', function(done) {
          // if there's a 'tx' attribute, it should ignore 'data' to avoid confusion
          const options1 = {
            data: ["0x6d02", "hello world"]
          }
          // 1. build initial transaction
          filepay.build(options1, function(err, tx1) {
            let exported_tx1 = tx1.toString();
            // 2. build a new transaction using the exported transaction + new data
            let options2 = {
              tx: exported_tx1,
              data: ["0x6d02", "bye world"]
            }
            filepay.build(options2, function(err, tx2) {
              assert.equal(tx1.toString(), tx2.toString())
              done()
            })
          })
        })
        it('tx + pay', function(done) {
          // tx1 is an unsigned transaction
          // and we create a signed version by adding the 'pay' attribute
          const options1 = {
            data: ["0x6d02", "hello world"]
          }
          // 1. build initial transaction
          filepay.build(options1, function(err, tx1) {
            let exported_tx1 = tx1.toString();
            // 2. build a new transaction using the exported transaction + new data
            let options2 = {
              tx: exported_tx1,
              pay: {
                key: privKey
              }
            }
            filepay.build(options2, function(err, tx2) {
              console.log('txpay', options2, err, tx2,)
              // tx1's input should be empty
              assert.equal(tx1.inputs.length, 0)
              // tx2's input should now have as many as the utxoSize
              assert.equal(tx2.inputs.length, utxoSize)

              // tx1's output should have one item
              assert.equal(tx1.outputs.length, 1)
              let script1 = new bitcoin.Script(tx1.outputs[0].script)
              assert(script1.chunks[0].opcodenum === bitcoin.Opcode.OP_FALSE)
              assert(script1.chunks[1].opcodenum === bitcoin.Opcode.OP_RETURN)

              // tx2's output should have two items
              console.log('tx2', tx2.toObject());
              assert.equal(tx2.outputs.length, 2)
              let script2 = [
                new bitcoin.Script(tx2.outputs[0].script),
                new bitcoin.Script(tx2.outputs[1].script)
              ]
              assert(script2[0].chunks[0].opcodenum === bitcoin.Opcode.OP_FALSE)
              assert(script2[0].chunks[1].opcodenum === bitcoin.Opcode.OP_RETURN)
              // the second script is a pubkeyhashout (change address)
              assert(script2[1].isPublicKeyHashOut())
              done()
            })
          })
        })
        it('tx + pay + data', function(done) {
          // tx1 is an unsigned transaction
          // and we create a signed version by adding the 'pay' attribute
          // but this time we also try to sneak in 'data'
          // the 'data' should be ignored
          const options1 = {
            data: ["0x6d02", "hello world"]
          }
          // 1. build initial transaction
          filepay.build(options1, function(err, tx1) {
            let exported_tx1 = tx1.toString();
            // 2. build a new transaction using the exported transaction + new data
            let options2 = {
              tx: exported_tx1,
              data: ["0x6d02", "bye world"],  // trying to sneak in 'data'
              pay: {
                key: privKey
              }
            }
            filepay.build(options2, function(err, tx2) {

              // tx2's input should now have as many as the utxoSize
              assert.equal(tx2.inputs.length, utxoSize)

              // tx2's output should have two items
              console.log('tx2', tx2);
              assert.equal(tx2.outputs.length, 2)
              let script2 = [
                new bitcoin.Script(tx2.outputs[0].script),
                new bitcoin.Script(tx2.outputs[1].script)
              ]
              // the first should be OP_RETURN
              assert(script2[0].chunks[0].opcodenum === bitcoin.Opcode.OP_FALSE)
              assert(script2[0].chunks[1].opcodenum === bitcoin.Opcode.OP_RETURN)
              // the second script is a pubkeyhashout (change address)
              assert(script2[1].isPublicKeyHashOut())

              // the script for the original OP_RETURN
              // should match the new OP_RETURN script
              // because the 'data' attribute was ignored
              let script1 = new bitcoin.Script(tx1.outputs[0].script)
              assert.equal(script1.toString(), script2[0].toString())
              done()
            })
          })
        })
      })
        /*
      describe('importing signed tx', function() {

        it('tx only', function(done) {
          const options1 = {
            data: ["0x6d02", "hello world"],
            pay: { key: privKey }
          }
          // 1. build initial transaction
          filepay.build(options1, function(err, tx1) {
            let exported_tx1 = tx1.toString();
            // 2. import transaction
            filepay.build({ tx: exported_tx1 }, function(err, tx2) {
              // the imported transaction should have as many as the utxoSize
              assert.equal(tx2.inputs.length, utxoSize)
              // the input should have 'script' property
              assert(tx2.inputs[0].script)
              // the script should be public key hash in
              let script = new bitcoin.Script(tx2.inputs[0].script)
              assert(script.isPublicKeyHashIn())
              // the imported transaction's input script address should match
              // the address corresponding to the originally imported private key
              const address = new bitcoin.PrivateKey(privKey).toAddress()
              assert.equal(address.toString(), script.toAddress().toString())
              done()
            })
          })
        })
        it('tx + data', function(done) {
          // the transaction has already been signed
          // the data should be ignored
          // Better yet, this shouldn't be used
          const options1 = {
            data: ["0x6d02", "hello world"],
            pay: { key: privKey }
          }
          // 1. build initial transaction
          filepay.build(options1, function(err, tx1) {
            let exported_tx1 = tx1.toString();
            // 2. import transaction
            filepay.build({
              tx: exported_tx1,
              data: ["0x6d02", "bye world"]
            }, function(err, tx2) {
              assert(err.toString(), "the transaction is already signed and cannot be modified")
              assert.equal(tx2, undefined)
              done()
            })
          })
        })
        it('tx+ pay', function(done) {
          // the transaction has already been signed
          // the pay attribute should be ignored
          // and throw and error
          const options1 = {
            data: ["0x6d02", "hello world"],
            pay: { key: privKey }
          }
          // 1. build initial transaction
          filepay.build(options1, function(err, tx1) {
            let exported_tx1 = tx1.toString();
            // 2. import transaction
            // But this time, we're updating the key attribute.
            // This should re-sign the transaction
            filepay.build({
              tx: exported_tx1,
              pay: {
                key: privKey
              }
            }, function(err, tx2) {
              assert(err.toString(), "the transaction is already signed and cannot be modified")
              assert.equal(tx2, undefined)
              done()
            })
          })
        })
        it('tx + pay + data', function(done) {
          const options1 = {
            data: ["0x6d02", "hello world"],
            pay: { key: privKey }
          }
          // 1. build initial transaction
          filepay.build(options1, function(err, tx1) {
            let exported_tx1 = tx1.toString();
            // 2. import transaction
            // But this time, we're updating the key attribute.
            // This should re-sign the transaction
            filepay.build({
              tx: exported_tx1,
              data: ["0x6d02", "bye world"],
              pay: {
                key: privKey
              }
            }, function(err, tx2) {
              assert(err.toString(), "the transaction is already signed and cannot be modified")
              assert.equal(tx2, undefined)
              done()
            })
          })
        })

      })
       */
    })
  })
});

describe('Extra', function() {
  describe('advanced', function() {
    describe('bitcoin', function() {
      it('exposes bitcoin', function() {
        assert(filepay.bsv.Networks)
        assert(filepay.bsv.Opcode)
        assert(filepay.bsv.Transaction)
        assert(filepay.bsv.Script)
      })
    })
    describe('data2script', function() {
      it('Handles empty array', function() {
        assert.equal(filepay.data2script(), '')
      })
      it('Handles sample script', function() {
        const s = filepay.data2script(['0x00', '0x6d', '0x031234']);
        assert.equal(s.toHex(), '006a0100016d03031234')
        assert.equal(s.toASM(), '0 OP_RETURN 00 6d 031234')
      })
      it('Handles sample script utf8', function() {
        const s = filepay.data2script(['0x00', '0x6d', 'hello world']);
        assert.equal(s.toHex(), '006a0100016d0b68656c6c6f20776f726c64')
        assert.equal(s.toASM(), '0 OP_RETURN 00 6d 68656c6c6f20776f726c64')
      })
    })
  })
  describe('provide manual inputs current', function() {
    it('Check change is generated', function(done) {
      function buildNBKeyOut(to) {
        if (to instanceof bitcoin.PublicKey) {
          to = to.toAddress()
        } else if (typeof to ==='string') {
          to = new bitcoin.Address(to)
        }
        var s = new bitcoin.Script()
        s.add(bitcoin.Opcode.OP_2DROP)
          .add(bitcoin.Opcode.OP_DUP)
          .add(bitcoin.Opcode.OP_HASH160)
          .add(to.hashBuffer)
          .add(bitcoin.Opcode.OP_EQUALVERIFY)
          .add(bitcoin.Opcode.OP_CHECKSIG)
        s._network = to.network
        return s
      }
      const address = new bitcoin.PrivateKey(privKey).toAddress()
      const s = buildNBKeyOut(address);
      const options = {
        data: ["hello world"],
        pay: {
          key: privKey,
          inputs: [
            {
              "txid": "49f366aae0b6b58474cca308af49e4961ede8e0af6327422389eddca615d6b1d",
              "value": 10000,
              "script": "76a91418dc40d469c624fab7c9ad9fd7aed36d4446f04b88ac",
              "outputIndex": 0,
              "required": true,
            }
          ],
          to: [{ script: s, value: 601 }]
        }
      }
      filepay.build(options, function(err, tx) {
        // If only 'key' is included, it will use the default values for
        // rest of the pay attributes
        // and make a transaction that sends money to oneself
        // (since no receiver is specified)
        let generated = tx.toObject();
        assert.deepEqual(generated, {
          "hash":"666bff4e62d0a290552ca2c61b808ada6ea259ad051be77963430f96c712ab07",
          "version":1,
          "inputs":[
             {
                "prevTxId":"49f366aae0b6b58474cca308af49e4961ede8e0af6327422389eddca615d6b1d",
                "outputIndex":0,
                "sequenceNumber":4294967295,
                "script":"463043021f60bd75f68c8a6560d947cd7ac2c316f62ec1809da3e9f5a9513a5078981e130220718096a5cd6245f4e00856138bc840e535c717cfe2600acdc739aa2b295e37d6412102119ebe4639964590bcf358539740f8ea4b6546b8416cbbbf6de12fafd3a13d1a",
                "scriptString":"70 0x3043021f60bd75f68c8a6560d947cd7ac2c316f62ec1809da3e9f5a9513a5078981e130220718096a5cd6245f4e00856138bc840e535c717cfe2600acdc739aa2b295e37d641 33 0x02119ebe4639964590bcf358539740f8ea4b6546b8416cbbbf6de12fafd3a13d1a",
                "output":{
                   "satoshis":10000,
                   "script":"76a91418dc40d469c624fab7c9ad9fd7aed36d4446f04b88ac"
                }
             }
          ],
          "outputs":[
             {
                "satoshis":0,
                "script":"006a0b68656c6c6f20776f726c64"
             },
             {
                "satoshis":601,
                "script":"6d76a914161e9c31fbec37d9ecb297bf4b814c6e189dbe5288ac"
             },
             {
                "satoshis":9250,
                "script":"76a914161e9c31fbec37d9ecb297bf4b814c6e189dbe5288ac"
             }
          ],
          "nLockTime":0
       });
        done()
      })
    });

    it('1 sufficient input using parent key', function(done) {
      const address = new bitcoin.PrivateKey(privKey).toAddress()
      const options = {
        data: [{op: 78}, "hello world"],
        pay: {
          key: privKey,
          inputs: [
            {
              "txid": "ef1708d1b36e4a0f510bcf1220d1c9ca49a4a9f12d6b8e76eb2b47797e217db9",
              "value": 13214,
              "script": "76a914161e9c31fbec37d9ecb297bf4b814c6e189dbe5288ac",
              "outputIndex": 1
            }
          ],
          to: [{ address: address, value: 546 }]
        }
      }
      filepay.build(options, function(err, tx) {
        // If only 'key' is included, it will use the default values for
        // rest of the pay attributes
        // and make a transaction that sends money to oneself
        // (since no receiver is specified)
        let generated = tx.toObject();
        assert.deepEqual(generated, {
          "hash":"17d1a0603ab8b705639dfe3d18ccf875b7db8864efa001f22f656e0e3cf52121",
          "version":1,
          "inputs":[
             {
                "prevTxId":"ef1708d1b36e4a0f510bcf1220d1c9ca49a4a9f12d6b8e76eb2b47797e217db9",
                "outputIndex":1,
                "sequenceNumber":4294967295,
                "script":"483045022100f41e10ffc9b8b22a32d485640124dd76b999404ff10e1a690f8028df1ec653f102205c8f0bf1d51c43c38b8fe74d2649fee44db13a6345062b8f4d635d6a7a90f71a412102119ebe4639964590bcf358539740f8ea4b6546b8416cbbbf6de12fafd3a13d1a",
                "scriptString":"72 0x3045022100f41e10ffc9b8b22a32d485640124dd76b999404ff10e1a690f8028df1ec653f102205c8f0bf1d51c43c38b8fe74d2649fee44db13a6345062b8f4d635d6a7a90f71a41 33 0x02119ebe4639964590bcf358539740f8ea4b6546b8416cbbbf6de12fafd3a13d1a",
                "output":{
                   "satoshis":13214,
                   "script":"76a914161e9c31fbec37d9ecb297bf4b814c6e189dbe5288ac"
                }
             }
          ],
          "outputs":[
             {
                "satoshis":0,
                "script":"006a4e0b68656c6c6f20776f726c64"
             },
             {
                "satoshis":546,
                "script":"76a914161e9c31fbec37d9ecb297bf4b814c6e189dbe5288ac"
             },
             {
                "satoshis":12519,
                "script":"76a914161e9c31fbec37d9ecb297bf4b814c6e189dbe5288ac"
             }
          ],
          "nLockTime":0,
        });
        done()
      })
    });

    it('1 insufficient input', function(done) {
      const address = new bitcoin.PrivateKey(privKey).toAddress()
      const options = {
        data: [{op: 78}, "hello world"],
        pay: {
          key: privKey,
          inputs: [
            {
              "txid": "ef1708d1b36e4a0f510bcf1220d1c9ca49a4a9f12d6b8e76eb2b47797e217db9",
              "value": 13214,
              "script": "76a914161e9c31fbec37d9ecb297bf4b814c6e189dbe5288ac",
              "outputIndex": 1
            }
          ],
          to: [{ address: address, value: 13214 }]
        }
      }
      filepay.build(options, function(err, tx) {
        // If only 'key' is included, it will use the default values for
        // rest of the pay attributes
        // and make a transaction that sends money to oneself
        // (since no receiver is specified)
        let generated = tx.toObject();
        assert.deepEqual(generated, {
          "hash":"f36667c10f41796ede2a0bf7c228241a0a650967d472713a78005dbc592e925a",
          "version":1,
          "inputs":[
             {
                "prevTxId":"ef1708d1b36e4a0f510bcf1220d1c9ca49a4a9f12d6b8e76eb2b47797e217db9",
                "outputIndex":1,
                "sequenceNumber":4294967295,
                "script":"483045022100e865e7c5aa3fad64596f14507e39e1a40bd28bfb247b593274ea287a6dea69f802201a540a7adb65dae065a735400043969237493d88e2350e3b563839ec57a74d1d412102119ebe4639964590bcf358539740f8ea4b6546b8416cbbbf6de12fafd3a13d1a",
                "scriptString":"72 0x3045022100e865e7c5aa3fad64596f14507e39e1a40bd28bfb247b593274ea287a6dea69f802201a540a7adb65dae065a735400043969237493d88e2350e3b563839ec57a74d1d41 33 0x02119ebe4639964590bcf358539740f8ea4b6546b8416cbbbf6de12fafd3a13d1a",
                "output":{
                   "satoshis":13214,
                   "script":"76a914161e9c31fbec37d9ecb297bf4b814c6e189dbe5288ac"
                }
             },
             {
                "prevTxId":"2f65137399213afad9804662329cf2351e46a624f9ab61a3a9e45adedb1cebbe",
                "outputIndex":1,
                "sequenceNumber":4294967295,
                "script":"483045022100abdb25dbe45f4ccc2ebf4f3fd78c45e2312195548d61af4f1becdee20e95c9c302207f660c85b0150f4f2043f50927713014c1ddce391e71d81b0fa14ba6261bcae4412102119ebe4639964590bcf358539740f8ea4b6546b8416cbbbf6de12fafd3a13d1a",
                "scriptString":"72 0x3045022100abdb25dbe45f4ccc2ebf4f3fd78c45e2312195548d61af4f1becdee20e95c9c302207f660c85b0150f4f2043f50927713014c1ddce391e71d81b0fa14ba6261bcae441 33 0x02119ebe4639964590bcf358539740f8ea4b6546b8416cbbbf6de12fafd3a13d1a",
                "output":{
                   "satoshis":546,
                   "script":"76a914161e9c31fbec37d9ecb297bf4b814c6e189dbe5288ac"
                }
             }
          ],
          "outputs":[
             {
                "satoshis":0,
                "script":"006a4e0b68656c6c6f20776f726c64"
             },
             {
                "satoshis":13214,
                "script":"76a914161e9c31fbec37d9ecb297bf4b814c6e189dbe5288ac"
             }
          ],
          "nLockTime":0,
          "changeScript":"OP_DUP OP_HASH160 20 0x161e9c31fbec37d9ecb297bf4b814c6e189dbe52 OP_EQUALVERIFY OP_CHECKSIG"
        });
        done()
      })
    })

    it('1 insufficient input and force specific input utxo', function(done) {
      const address = new bitcoin.PrivateKey(privKey).toAddress()
      const options = {
        data: [{op: 78}, "hello world"],
        pay: {
          key: privKey,
          inputs: [
            {
              "txid": "2f65137399213afad9804662329cf2351e46a624f9ab61a3a9e45adedb1cebbe",
              "value": 546,
              "script": "76a914161e9c31fbec37d9ecb297bf4b814c6e189dbe5288ac",
              "outputIndex": 1,
              "required": true
            }
          ],
          to: [{ address: address, value: 20000 }]
        }
      }
      filepay.build(options, function(err, tx) {
        // If only 'key' is included, it will use the default values for
        // rest of the pay attributes
        // and make a transaction that sends money to oneself
        // (since no receiver is specified)
        let generated = tx.toObject();
        assert.deepEqual(generated,
          {
            "hash":"b867ad8c367697847be8587611f8ce133860039b5c2776f8f1d0ec490f6941ce",
            "version":1,
            "inputs":[
               {
                  "prevTxId":"2f65137399213afad9804662329cf2351e46a624f9ab61a3a9e45adedb1cebbe",
                  "outputIndex":1,
                  "sequenceNumber":4294967295,
                  "script":"483045022100bc7c386d9c3740a4817eedf0f193047fa3728f1a6e0bb531c4fb37321f8d44d3022058054d8e0b45215af9384da2f5876534073996a956ac41d26037b6dd02c8103d412102119ebe4639964590bcf358539740f8ea4b6546b8416cbbbf6de12fafd3a13d1a",
                  "scriptString":"72 0x3045022100bc7c386d9c3740a4817eedf0f193047fa3728f1a6e0bb531c4fb37321f8d44d3022058054d8e0b45215af9384da2f5876534073996a956ac41d26037b6dd02c8103d41 33 0x02119ebe4639964590bcf358539740f8ea4b6546b8416cbbbf6de12fafd3a13d1a",
                  "output":{
                     "satoshis":546,
                     "script":"76a914161e9c31fbec37d9ecb297bf4b814c6e189dbe5288ac"
                  }
               },
               {
                  "prevTxId":"ecd3f4b47128cbfe0dafb3640b728dd501ea4cbc63c90abd46e4e825e3f98dd0",
                  "outputIndex":1,
                  "sequenceNumber":4294967295,
                  "script":"47304402204505ec2ed131e9075ae295bbbc27636a16c01336f81f25c813c43dbaabd66fbf02206383b144689dff8ae957b5755a413b9e7e87a589d09f62695979ffdc167c0a07412102119ebe4639964590bcf358539740f8ea4b6546b8416cbbbf6de12fafd3a13d1a",
                  "scriptString":"71 0x304402204505ec2ed131e9075ae295bbbc27636a16c01336f81f25c813c43dbaabd66fbf02206383b144689dff8ae957b5755a413b9e7e87a589d09f62695979ffdc167c0a0741 33 0x02119ebe4639964590bcf358539740f8ea4b6546b8416cbbbf6de12fafd3a13d1a",
                  "output":{
                     "satoshis":20000,
                     "script":"76a914161e9c31fbec37d9ecb297bf4b814c6e189dbe5288ac"
                  }
               }
            ],
            "outputs":[
               {
                  "satoshis":0,
                  "script":"006a4e0b68656c6c6f20776f726c64"
               },
               {
                  "satoshis":20000,
                  "script":"76a914161e9c31fbec37d9ecb297bf4b814c6e189dbe5288ac"
               }
            ],
            "nLockTime":0,
            "changeScript":"OP_DUP OP_HASH160 20 0x161e9c31fbec37d9ecb297bf4b814c6e189dbe52 OP_EQUALVERIFY OP_CHECKSIG"
         }
         );
        done()
      })
    })

    it('1 insufficient input and force specific input utxo provide unlocking script', function(done) {
      const address = new bitcoin.PrivateKey(privKey).toAddress();

      /**
       * Perform basic p2pkh type signing of an arbitrary input.
       *
       * @param {*} tx Transaction used for signing
       * @param {*} index index of the input
       * @param {*} satoshis satoshi of the input
       * @param {*} script script of the input
       * @param {*} key private key that can sign
       */
      function signBasic(tx, index, satoshis, script, key) {
        const privKey = new bitcoin.PrivateKey(key);
        const publicKey = privKey.publicKey;
        const sigtype = bitcoin.crypto.Signature.SIGHASH_ALL | bitcoin.crypto.Signature.SIGHASH_FORKID;
        const flags = bitcoin.Script.Interpreter.SCRIPT_VERIFY_MINIMALDATA | bitcoin.Script.Interpreter.SCRIPT_ENABLE_SIGHASH_FORKID | bitcoin.Script.Interpreter.SCRIPT_ENABLE_MAGNETIC_OPCODES | bitcoin.Script.Interpreter.SCRIPT_ENABLE_MONOLITH_OPCODES;
        let signature = bitcoin.Transaction.sighash.sign(tx, privKey, sigtype, index, script, new bitcoin.crypto.BN(satoshis), flags);
        signature = signature.toBuffer()
        var script = new bitcoin.Script()
          .add(Buffer.concat([
            signature,
            Buffer.from([(sigtype || bitcoin.Signature.SIGHASH_ALL) & 0xff])
          ]))
          .add(new bitcoin.PublicKey(publicKey).toBuffer())
        return script;
      }

      const options = {
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
                console.log('-------unlockingScript-------');
                console.log(tx, index, satoshis, script, key);
                return signBasic(tx, index, satoshis, script, key);
              }
            },
            {
              "txid": "2f65137399213afad9804662329cf2351e46a624f9ab61a3a9e45adedb1cebbe",
              "value": 9305,
              "script": "76a914161e9c31fbec37d9ecb297bf4b814c6e189dbe5288ac",
              "outputIndex": 2,
              "required": true
            }
          ]
        }
      }
      filepay.build(options, function(err, tx, fee) {
        // If only 'key' is included, it will use the default values for
        // rest of the pay attributes
        // and make a transaction that sends money to oneself
        // (since no receiver is specified)
        let generated = tx.toObject();
        console.log('generated', JSON.stringify(generated), tx.toString());
        assert.deepEqual(generated, {
          "hash":"61cdbde68c788e2616a1acc1eeaea86997c7e6379adc5a289afc609bce1a8aa9",
          "version":1,
          "inputs":[
             {
                "prevTxId":"2f65137399213afad9804662329cf2351e46a624f9ab61a3a9e45adedb1cebbe",
                "outputIndex":2,
                "sequenceNumber":4294967295,
                "script":"47304402203492e8e9036ee411d317c3f9cf02650540421c9517b7c8dc96ece6d44705514a02206f19031f62f03eaa4241eb1a5b131bc7a66ed124d8e5b77301a4f9a703858bcc412102119ebe4639964590bcf358539740f8ea4b6546b8416cbbbf6de12fafd3a13d1a",
                "scriptString":"71 0x304402203492e8e9036ee411d317c3f9cf02650540421c9517b7c8dc96ece6d44705514a02206f19031f62f03eaa4241eb1a5b131bc7a66ed124d8e5b77301a4f9a703858bcc41 33 0x02119ebe4639964590bcf358539740f8ea4b6546b8416cbbbf6de12fafd3a13d1a",
                "output":{
                   "satoshis":9305,
                   "script":"76a914161e9c31fbec37d9ecb297bf4b814c6e189dbe5288ac"
                }
             },
             {
                "prevTxId":"19b99a8b4a8c8c1d2e3130945aeda7d8070104af2ff9320667d95fd1a311ea12",
                "outputIndex":2,
                "sequenceNumber":4294967295,
                "script":"483045022100bc2b3b59c65457e240f81df9528774ffcecabce3bcf231b774ce2e0163b2a52702207b81a8e0671c76f19480ec80e540e19964428589c126fcfecaba90df5df6cfe0412102119ebe4639964590bcf358539740f8ea4b6546b8416cbbbf6de12fafd3a13d1a",
                "scriptString":"72 0x3045022100bc2b3b59c65457e240f81df9528774ffcecabce3bcf231b774ce2e0163b2a52702207b81a8e0671c76f19480ec80e540e19964428589c126fcfecaba90df5df6cfe041 33 0x02119ebe4639964590bcf358539740f8ea4b6546b8416cbbbf6de12fafd3a13d1a",
                "output":{
                   "satoshis":786,
                   "script":"76a914161e9c31fbec37d9ecb297bf4b814c6e189dbe5288ac"
                }
             }
          ],
          "outputs":[
             {
                "satoshis":0,
                "script":"006a0b68656c6c6f20776f726c64"
             },
             {
                "satoshis":9898,
                "script":"76a914161e9c31fbec37d9ecb297bf4b814c6e189dbe5288ac"
             }
          ],
          "nLockTime":0
        });
        done()
      })
    })

    it('check change is generated correctly 1 forced input', function(done) {
      const options = {
        data: ["hello world"],
        pay: {
          key: privKey,
          inputs: [
            {
              "txid": "72f09e0ec141eefcc4788daa8ce1f56e82dc2645346d859e1e9ec8ef1cbcce70",
              "value": 1000,
              "script": "76a914161e9c31fbec37d9ecb297bf4b814c6e189dbe5288ac",
              "outputIndex": 0,
              "required": true
            },
            {
              "txid": "2f65137399213afad9804662329cf2351e46a624f9ab61a3a9e45adedb1cebbe",
              "value": 9305,
              "script": "76a914161e9c31fbec37d9ecb297bf4b814c6e189dbe5288ac",
              "outputIndex": 2,
              "required": true
            }
          ],
          to: [
            {
              script: '76a914801c259a527abd83a977fd90a06b22d215fcad4988ac',
              value: 18500
            }
          ]
        }
      }
      filepay.build(options, function(err, tx) {
        // If only 'key' is included, it will use the default values for
        // rest of the pay attributes
        // and make a transaction that sends money to oneself
        // (since no receiver is specified)
        let generated = tx.toObject();
        console.log('generated', tx.toString(), JSON.stringify(generated));
        assert.deepEqual(generated, {
          "hash":"28ef54cc59bc8b666aadfec76f0aec03834b50a0a7b3296f30497b1a4fdcc68c",
          "version":1,
          "inputs":[
             {
                "prevTxId":"19b99a8b4a8c8c1d2e3130945aeda7d8070104af2ff9320667d95fd1a311ea12",
                "outputIndex":1,
                "sequenceNumber":4294967295,
                "script":"483045022100d11235ec86e7dac995be3f6f52b5f8070b9b119318a78f36d73c9efc47492c2a02204a4f511a8486c06bf84f7c9f8e09159674c23568f8487aa3f287e6b43d8c67e5412102119ebe4639964590bcf358539740f8ea4b6546b8416cbbbf6de12fafd3a13d1a",
                "scriptString":"72 0x3045022100d11235ec86e7dac995be3f6f52b5f8070b9b119318a78f36d73c9efc47492c2a02204a4f511a8486c06bf84f7c9f8e09159674c23568f8487aa3f287e6b43d8c67e541 33 0x02119ebe4639964590bcf358539740f8ea4b6546b8416cbbbf6de12fafd3a13d1a",
                "output":{
                   "satoshis":20000,
                   "script":"76a914161e9c31fbec37d9ecb297bf4b814c6e189dbe5288ac"
                }
             }
          ],
          "outputs":[
             {
                "satoshis":0,
                "script":"006a4e0b68656c6c6f20776f726c64"
             },
             {
                "satoshis":19873,
                "script":"76a914161e9c31fbec37d9ecb297bf4b814c6e189dbe5288ac"
             }
          ],
          "nLockTime":0
       });
        done()
      })
    })
  });

  describe('bsv-coinselect', function() {
    describe('no coinselect', function() {

      it('Handles accumulate 1 feeRate', function() {
        const utxos = [
          {
            "address": "1CgPDEav5fdzry3V7tGADY4rHqG8oi4kfv",
            "txid": "a939afcb78a06239f02eefbfaabc6e0a78dfe3cd64f9676932cc1195796fa42f",
            "vout": 1,
            "amount": 0.90120691,
            "satoshis": 90120691,
            "value": 90120691,
            "height": 617496,
            "confirmations": 18639,
            "scriptPubKey": "76a914801c259a527abd83a977fd90a06b22d215fcad4988ac",
            "script": "76a914801c259a527abd83a977fd90a06b22d215fcad4988ac",
            "outputIndex": 1
          },
          {
            "address": "1CgPDEav5fdzry3V7tGADY4rHqG8oi4kfv",
            "txid": "716e6b12d111984818d8c5e6d68446a52746d480d397d077cad598d55f059a65",
            "vout": 1,
            "amount": 1.00132764,
            "satoshis": 100132764,
            "value": 100132764,
            "height": 616468,
            "confirmations": 19667,
            "scriptPubKey": "76a914801c259a527abd83a977fd90a06b22d215fcad4988ac",
            "script": "76a914801c259a527abd83a977fd90a06b22d215fcad4988ac",
            "outputIndex": 1
          },
          {
            "address": "1CgPDEav5fdzry3V7tGADY4rHqG8oi4kfv",
            "txid": "98e0987b5b5783ae083814f448f1dda52c18c881beda649c36576d0c81ee31f9",
            "vout": 1,
            "amount": 29.46201319,
            "satoshis": 3000,
            "value": 3000,
            "height": 610466,
            "confirmations": 25669,
            "scriptPubKey": "76a914801c259a527abd83a977fd90a06b22d215fcad4988ac",
            "script": "76a914801c259a527abd83a977fd90a06b22d215fcad4988ac",
            "outputIndex": 1
          }
        ];
        const bsvCoinselect = filepay.coinselect;
        const outputs = [
          {
            script: '76a914801c259a527abd83a977fd90a06b22d215fcad4988ac',
            value: 1000,
          }
        ];
        const tx = bsvCoinselect(utxos, outputs, 1, undefined);

        assert.deepEqual(tx, {
          fee: 100131764,
          inputs: [
            {
              "address": "1CgPDEav5fdzry3V7tGADY4rHqG8oi4kfv",
              "txid": "716e6b12d111984818d8c5e6d68446a52746d480d397d077cad598d55f059a65",
              "vout": 1,
              "amount": 1.00132764,
              "satoshis": 100132764,
              "value": 100132764,
              "height": 616468,
              "confirmations": 19667,
              "scriptPubKey": "76a914801c259a527abd83a977fd90a06b22d215fcad4988ac",
              "script": "76a914801c259a527abd83a977fd90a06b22d215fcad4988ac",
              "outputIndex": 1
            },
          ],
          "outputs": [
            {
              "value": 1000,
              "script": "76a914801c259a527abd83a977fd90a06b22d215fcad4988ac"
            }
          ]
        });
      })

      it('Handles accumulate 0.5 feerate', function() {
        const utxos = [
          {
            "address": "1CgPDEav5fdzry3V7tGADY4rHqG8oi4kfv",
            "txid": "a939afcb78a06239f02eefbfaabc6e0a78dfe3cd64f9676932cc1195796fa42f",
            "vout": 1,
            "amount": 0.90120691,
            "satoshis": 90120691,
            "value": 90120691,
            "height": 617496,
            "confirmations": 18639,
            "scriptPubKey": "76a914801c259a527abd83a977fd90a06b22d215fcad4988ac",
            "script": "76a914801c259a527abd83a977fd90a06b22d215fcad4988ac",
            "outputIndex": 1
          },
          {
            "address": "1CgPDEav5fdzry3V7tGADY4rHqG8oi4kfv",
            "txid": "716e6b12d111984818d8c5e6d68446a52746d480d397d077cad598d55f059a65",
            "vout": 1,
            "amount": 1.00132764,
            "satoshis": 100132764,
            "value": 100132764,
            "height": 616468,
            "confirmations": 19667,
            "scriptPubKey": "76a914801c259a527abd83a977fd90a06b22d215fcad4988ac",
            "script": "76a914801c259a527abd83a977fd90a06b22d215fcad4988ac",
            "outputIndex": 1
          },
          {
            "address": "1CgPDEav5fdzry3V7tGADY4rHqG8oi4kfv",
            "txid": "98e0987b5b5783ae083814f448f1dda52c18c881beda649c36576d0c81ee31f9",
            "vout": 1,
            "amount": 29.46201319,
            "satoshis": 3000,
            "value": 3000,
            "height": 610466,
            "confirmations": 25669,
            "scriptPubKey": "76a914801c259a527abd83a977fd90a06b22d215fcad4988ac",
            "script": "76a914801c259a527abd83a977fd90a06b22d215fcad4988ac",
            "outputIndex": 1
          }
        ];
        const bsvCoinselect = filepay.coinselect;
        const outputs = [
          {
            script: '76a914801c259a527abd83a977fd90a06b22d215fcad4988ac',
            value: 1000,
          }
        ];
        const tx2 = bsvCoinselect(utxos, outputs, 0.5, null);
        assert.deepEqual(tx2, {
          fee: 98,
          inputs: [
            {
              "address": "1CgPDEav5fdzry3V7tGADY4rHqG8oi4kfv",
              "txid": "716e6b12d111984818d8c5e6d68446a52746d480d397d077cad598d55f059a65",
              "vout": 1,
              "amount": 1.00132764,
              "satoshis": 100132764,
              "value": 100132764,
              "height": 616468,
              "confirmations": 19667,
              "scriptPubKey": "76a914801c259a527abd83a977fd90a06b22d215fcad4988ac",
              "script": "76a914801c259a527abd83a977fd90a06b22d215fcad4988ac",
              "outputIndex": 1
            },
          ],
          "outputs": [
            {
              "value": 1000,
              "script": "76a914801c259a527abd83a977fd90a06b22d215fcad4988ac"
            },
            {
              "script": null,
              "value": 100131666
              //"value": 100131667 //2946200125
            }
          ]
        });

        const tx3 = bsvCoinselect(utxos, outputs, 0.5, undefined);
        assert.deepEqual(tx3, {
          fee: 100131764,
          inputs: [
            {
              "address": "1CgPDEav5fdzry3V7tGADY4rHqG8oi4kfv",
              "txid": "716e6b12d111984818d8c5e6d68446a52746d480d397d077cad598d55f059a65",
              "vout": 1,
              "amount": 1.00132764,
              "satoshis": 100132764,
              "value": 100132764,
              "height": 616468,
              "confirmations": 19667,
              "scriptPubKey": "76a914801c259a527abd83a977fd90a06b22d215fcad4988ac",
              "script": "76a914801c259a527abd83a977fd90a06b22d215fcad4988ac",
              "outputIndex": 1
            },
          ],
          "outputs": [
            {
              "value": 1000,
              "script": "76a914801c259a527abd83a977fd90a06b22d215fcad4988ac"
            }
          ]
        });
      })
    })

    it('Handles varying utxo values', function() {
      const utxos = [
        {
          "address": "1CgPDEav5fdzry3V7tGADY4rHqG8oi4kfv",
          "txid": "a939afcb78a06239f02eefbfaabc6e0a78dfe3cd64f9676932cc1195796fa42f",
          "vout": 1,
          "value": 1000,
          "height": 617496,
          "confirmations": 18639,
          "scriptPubKey": "76a914801c259a527abd83a977fd90a06b22d215fcad4988ac",
          "script": "76a914801c259a527abd83a977fd90a06b22d215fcad4988ac",
          "outputIndex": 1
        },
        {
          "address": "1CgPDEav5fdzry3V7tGADY4rHqG8oi4kfv",
          "txid": "716e6b12d111984818d8c5e6d68446a52746d480d397d077cad598d55f059a65",
          "vout": 1,
          "value": 5000,
          "height": 616468,
          "confirmations": 19667,
          "scriptPubKey": "76a914801c259a527abd83a977fd90a06b22d215fcad4988ac",
          "script": "76a914801c259a527abd83a977fd90a06b22d215fcad4988ac",
          "outputIndex": 1
        },
        {
          "address": "1CgPDEav5fdzry3V7tGADY4rHqG8oi4kfv",
          "txid": "98e0987b5b5783ae083814f448f1dda52c18c881beda649c36576d0c81ee31f9",
          "vout": 1,
          "value": 10004,
          "height": 610466,
          "confirmations": 25669,
          "scriptPubKey": "76a914801c259a527abd83a977fd90a06b22d215fcad4988ac",
          "script": "76a914801c259a527abd83a977fd90a06b22d215fcad4988ac",
          "outputIndex": 1
        }
      ];
      const outputs = [
        {
          script: '76a914801c259a527abd83a977fd90a06b22d215fcad4988ac',
          value: 1000,
        }
      ];
      const tx2 = bsvCoinselect(utxos, outputs, 0.5, null);
      assert.deepEqual(tx2, {
        fee: 98,
        inputs: [
          {
            "address": "1CgPDEav5fdzry3V7tGADY4rHqG8oi4kfv",
            "txid": "98e0987b5b5783ae083814f448f1dda52c18c881beda649c36576d0c81ee31f9",
            "vout": 1,
            "value": 10004,
            "height": 610466,
            "confirmations": 25669,
            "scriptPubKey": "76a914801c259a527abd83a977fd90a06b22d215fcad4988ac",
            "script": "76a914801c259a527abd83a977fd90a06b22d215fcad4988ac",
            "outputIndex": 1
          },
        ],
        "outputs": [
          {
            "value": 1000,
            "script": "76a914801c259a527abd83a977fd90a06b22d215fcad4988ac"
          },
          {
            script: null,
            "value": 8906
          }
        ]
      });

      const tx3 = bsvCoinselect(utxos, outputs, 0.1, null);
      assert.deepEqual(tx3, {
        fee: 20,
        inputs: [
          {
            "address": "1CgPDEav5fdzry3V7tGADY4rHqG8oi4kfv",
            "txid": "98e0987b5b5783ae083814f448f1dda52c18c881beda649c36576d0c81ee31f9",
            "vout": 1,
            "value": 10004,
            "height": 610466,
            "confirmations": 25669,
            "scriptPubKey": "76a914801c259a527abd83a977fd90a06b22d215fcad4988ac",
            "script": "76a914801c259a527abd83a977fd90a06b22d215fcad4988ac",
            "outputIndex": 1
          },
        ],
        "outputs": [
          {
            "value": 1000,
            "script": "76a914801c259a527abd83a977fd90a06b22d215fcad4988ac"
          },
          {
            script: undefined,
            "value": 8984 //2946200125
          }
        ]
      });

      const outputs2 = [
        {
          script: '76a914801c259a527abd83a977fd90a06b22d215fcad4988ac',
          value: 1000,
        },
        {
          script: '76a914801c259a527abd83a977fd90a06b22d215fcad4988ac',
          value: 546,
        },
        {
          script: '76a914801c259a527abd83a977fd90a06b22d215fcad4988ac',
          value: 1000,
        },
        {
          script: '76a914801c259a527abd83a977fd90a06b22d215fcad4988ac',
          value: 10000,
        }
      ];
      const changeScript = '76a914801c259a527abd83a977fd90a06b22d215fcad4988ac';
      const tx5 = bsvCoinselect(utxos, outputs2, 0.5, changeScript);
      assert.deepEqual(tx5, {
        fee: 232,
        inputs: [
          {
            "address": "1CgPDEav5fdzry3V7tGADY4rHqG8oi4kfv",
            "txid": "98e0987b5b5783ae083814f448f1dda52c18c881beda649c36576d0c81ee31f9",
            "vout": 1,
            "value": 10004,
            "height": 610466,
            "confirmations": 25669,
            "scriptPubKey": "76a914801c259a527abd83a977fd90a06b22d215fcad4988ac",
            "script": "76a914801c259a527abd83a977fd90a06b22d215fcad4988ac",
            "outputIndex": 1
          },
          {
            "address": "1CgPDEav5fdzry3V7tGADY4rHqG8oi4kfv",
            "txid": "716e6b12d111984818d8c5e6d68446a52746d480d397d077cad598d55f059a65",
            "vout": 1,
            "value": 5000,
            "height": 616468,
            "confirmations": 19667,
            "scriptPubKey": "76a914801c259a527abd83a977fd90a06b22d215fcad4988ac",
            "script": "76a914801c259a527abd83a977fd90a06b22d215fcad4988ac",
            "outputIndex": 1
          },
        ],
        "outputs": [
          {
            script: '76a914801c259a527abd83a977fd90a06b22d215fcad4988ac',
            value: 1000,
          },
          {
            script: '76a914801c259a527abd83a977fd90a06b22d215fcad4988ac',
            value: 546,
          },
          {
            script: '76a914801c259a527abd83a977fd90a06b22d215fcad4988ac',
            value: 1000,
          },
          {
            script: '76a914801c259a527abd83a977fd90a06b22d215fcad4988ac',
            value: 10000,
          },
          {
            // Automatically add change script
            script: '76a914801c259a527abd83a977fd90a06b22d215fcad4988ac',
            "value": 2226 //2946200125
          }
        ]
      });

      const outputs3 = [
        {
          script: '76a914801c259a527abd83a977fd90a06b22d215fcad4988ac',
          value: 15500,
        }
      ];

      const tx6 = bsvCoinselect(utxos, outputs3, 0.5, changeScript);
      assert.deepEqual(tx6, {
        fee: 504,
        inputs: [
          {
            "address": "1CgPDEav5fdzry3V7tGADY4rHqG8oi4kfv",
            "txid": "98e0987b5b5783ae083814f448f1dda52c18c881beda649c36576d0c81ee31f9",
            "vout": 1,
            "value": 10004,
            "height": 610466,
            "confirmations": 25669,
            "scriptPubKey": "76a914801c259a527abd83a977fd90a06b22d215fcad4988ac",
            "script": "76a914801c259a527abd83a977fd90a06b22d215fcad4988ac",
            "outputIndex": 1
          },
          {
            "address": "1CgPDEav5fdzry3V7tGADY4rHqG8oi4kfv",
            "txid": "716e6b12d111984818d8c5e6d68446a52746d480d397d077cad598d55f059a65",
            "vout": 1,
            "value": 5000,
            "height": 616468,
            "confirmations": 19667,
            "scriptPubKey": "76a914801c259a527abd83a977fd90a06b22d215fcad4988ac",
            "script": "76a914801c259a527abd83a977fd90a06b22d215fcad4988ac",
            "outputIndex": 1
          },
          {
            "address": "1CgPDEav5fdzry3V7tGADY4rHqG8oi4kfv",
            "txid": "a939afcb78a06239f02eefbfaabc6e0a78dfe3cd64f9676932cc1195796fa42f",
            "vout": 1,
            "value": 1000,
            "height": 617496,
            "confirmations": 18639,
            "scriptPubKey": "76a914801c259a527abd83a977fd90a06b22d215fcad4988ac",
            "script": "76a914801c259a527abd83a977fd90a06b22d215fcad4988ac",
            "outputIndex": 1
          },

        ],
        "outputs": [
          {
            script: '76a914801c259a527abd83a977fd90a06b22d215fcad4988ac',
            value: 15500,
          }
        ]
      });


      const outputs4 = [
        {
          script: '76a914801c259a527abd83a977fd90a06b22d215fcad4988ac',
          value: 15000,
        }
      ];

      const tx7 = bsvCoinselect(utxos, outputs4, 0.5, changeScript);
      assert.deepEqual(tx7, {
        fee: 189,
        inputs: [
          {
            "address": "1CgPDEav5fdzry3V7tGADY4rHqG8oi4kfv",
            "txid": "98e0987b5b5783ae083814f448f1dda52c18c881beda649c36576d0c81ee31f9",
            "vout": 1,
            "value": 10004,
            "height": 610466,
            "confirmations": 25669,
            "scriptPubKey": "76a914801c259a527abd83a977fd90a06b22d215fcad4988ac",
            "script": "76a914801c259a527abd83a977fd90a06b22d215fcad4988ac",
            "outputIndex": 1
          },
          {
            "address": "1CgPDEav5fdzry3V7tGADY4rHqG8oi4kfv",
            "txid": "716e6b12d111984818d8c5e6d68446a52746d480d397d077cad598d55f059a65",
            "vout": 1,
            "value": 5000,
            "height": 616468,
            "confirmations": 19667,
            "scriptPubKey": "76a914801c259a527abd83a977fd90a06b22d215fcad4988ac",
            "script": "76a914801c259a527abd83a977fd90a06b22d215fcad4988ac",
            "outputIndex": 1
          },
          {
            "address": "1CgPDEav5fdzry3V7tGADY4rHqG8oi4kfv",
            "txid": "a939afcb78a06239f02eefbfaabc6e0a78dfe3cd64f9676932cc1195796fa42f",
            "vout": 1,
            "value": 1000,
            "height": 617496,
            "confirmations": 18639,
            "scriptPubKey": "76a914801c259a527abd83a977fd90a06b22d215fcad4988ac",
            "script": "76a914801c259a527abd83a977fd90a06b22d215fcad4988ac",
            "outputIndex": 1
          },

        ],
        "outputs": [
          {
            script: '76a914801c259a527abd83a977fd90a06b22d215fcad4988ac',
            value: 15000,
          },
          {
            script: '76a914801c259a527abd83a977fd90a06b22d215fcad4988ac',
            value: 815,
          }
        ]
      });
    })
  })
})

