# Multi-user version scenario for Burndown Studio

## Assumptions and implementation Strategy

* All users are asked to login with the google email id.
* But for local test will allow fake email id to enroll the system.
* Before deploying to cloud I want to check if registering with google works.
* And then final deployment on cloud will be done and burndown studio will be on air.

## User classification

1. Super Manager: Manager of the system. which is me
   * Register with google login as 'dkyoon@gmail.com'
   * Also can be a Product Manager with the same ID, for now.
2. Product Manager: Manages one or more teams
   * First register as a user with email id or google login
   * In Super Manger's operation page lookup the email id and register as Product Manager level
   * Product Manager can make teams(projects) and assign members to each team
   * Once logged in PM can see manging menu such as creating teams, and also can see the team cards.
   * If PM clicks team card PM will enter Burndown Studio with the same functionaly of team members
3. Members
   * All others than Super Manager and Product Manager
   * Register with google login then PM will assign an team
   * Once logged in member can see teams he/she is assigned. By clicking team it enters into the Burdown Studio.
   * One of the members in a team can be a team leader. 
   * For now there are no preserved roles but later I may allow only team leader for some features.

This version is the simplest first version to burndown studio for real use.  I will have my team first use this version.  I have a VPC setup on naver cloud with public IP.  I may use this for operaion but I am open to better deployment options.

