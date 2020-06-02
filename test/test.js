require('dotenv').config()
const assert = require('assert');
const bitcoin = require('bsv')
const filepay = require('../index');
const bsvCoinselect = filepay.coinselect;
// Private Key for Demo Purpose Only
const privKey = ''; //process.env.privKey
const address = new bitcoin.PrivateKey(privKey).toAddress()
var utxoSize;

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
          console.log('tx', tx);
          let generated = tx.toObject();
          // input length utxoSize => from the user specifiec by the private key
          console.log('utxo', generated, utxoSize);
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

