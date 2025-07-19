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

def remove_data_metric():

    metrics = ['player_injured', 'teamInjuries', 'opponentInjuries', 'lastUpdated', 'lastChecked', 'source']

    db = init_firestore()
    concluded = (
        db.collection("processedPlayers")
          .document("players")
          .collection("concluded")
    )
    for doc_snap in concluded.stream():
        data = doc_snap.to_dict() or {}

        for item in metrics:
    
            if item in data:
                # delete the 'points' field
                doc_snap.reference.update({
                    item: firestore.DELETE_FIELD
                })
                print(f"Removed '{item}' from {doc_snap.id}")

if __name__ == "__main__":
    remove_data_metric()