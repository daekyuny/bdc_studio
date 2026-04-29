# Updates To be considered

## bugs / vulnerabilites

The problems can be narrowed down as follows.                                            
1. When tasks are removed in the backlog tab while they are already assigned to a sprint.                                                      
2. Importing backlogs from excel where some tasks could be incompatile with previous tasks.                                                    
                                                                                                                                                 
For 1. I think the simplest solution is not to allow remove tasks which are already assigned to any sprints.
                                  
For 2. Imporing backlogs from excel is for coneveniences for the first time to set the backlogs. So we have the following cases.  In all cases, when updating/adding "assigned to" field, only the legitimate email id's of the team will be added. Otherwise ignored.

    2.0 if the task id is found and if already assgined to a sprint, this will just be ignored.
	2.1 if the task id is found in current backlog, and if the task is not assigned to any sprints the contents of the task will be replaced.
	2.2 The new task which belongs to already existing User storiy will be added to as a new task under the User story found.
	2.3 For the new User stories and the new tasks theses will be added as new stories tasks. 
	2.4 Only the new user storie, no tasks. the new user story will be added
	2.5 For a new task but which doesn't belong to any User story, this task will be skipped with warning. For example the new task id is 9.1.2  but there is no user story with the id "9.1". 

## from user feedback

## Small Updates

- in SM's administration
	- need to delete Group, but very cautiosly.

