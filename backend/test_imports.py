try:
    import videodb.timeline
    print(f"Module content: {dir(videodb.timeline)}")
    
    from videodb.timeline import Timeline
    print("Timeline import OK")

except Exception as e:
    print(f"Error: {e}")
