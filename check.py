#!/usr/bin/env python3
import firebase_admin
from firebase_admin import firestore


def init_firestore():
    """
    Initialize the Firestore client.
    Locally: set GOOGLE_APPLICATION_CREDENTIALS to your service account JSON.
    In Cloud Run/Functions: no extra setup needed.
    """
    if not firebase_admin._apps:
        firebase_admin.initialize_app()
    return firestore.client()

def check_data_metric():
    db = init_firestore()
    concluded = (
        db.collection("processedPlayers")
          .document("players")
          .collection("concluded")
    )
    i = 1

    
    value = 'playerTeamId'

    for doc_snap in concluded.stream():
        data = doc_snap.to_dict() or {}
        pick_id = data['pick_id']
        player_name = data['name'].lower()
        #injury = data.get(var)
        missing = False

        
        

        
        if value not in data:
            print(f"{i}: ❌  {doc_snap.id!r} missing '{value}'")
            missing = True
        #elif data[var] != 1 and data[var] != 0:
        #    print(f"{i}: ❌❌  {doc_snap.id!r} has {var}: '{data[var]}'")
        #    missing = True
        else:
            #print(f"{i}: ✅  {doc_snap.id!r} has '{value}'")
            print(f"{i}: ✅  {doc_snap.id!r} has {value}: '{data[value]}'")

        #if missing:
        #    print(f"Original Keys are: {list(data.keys())}")

        #print()
        i+=1


    

if __name__ == "__main__":
    check_data_metric()
