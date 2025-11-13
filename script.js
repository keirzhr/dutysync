// Example: test Firestore
db.collection("test").add({
  name: "Hello DutySync",
  created: new Date()
})
.then(() => console.log("Document added!"))
.catch(error => console.error(error));
